import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import { touchSession } from "@/lib/chatStore";
import { speechPlayer } from "@/lib/voice/speechPlayer";
import { streamGroupChat } from "./stream";

/**
 * React side of group-chat streaming.
 *
 * `./stream.ts` speaks the wire protocol (NDJSON events over `fetch`); this hook
 * turns those events into persona bubbles in the chat view and, with read-aloud
 * on, into live utterances in the speech player. Together they are the whole
 * streaming feature — the view only calls `send` and reads the flags.
 */

// A stream cut after it started: the server keeps going and saves the turn.
const STREAM_INTERRUPTED_SAVED_MESSAGE =
  "Connection lost while the replies were streaming. They are still being saved — reopen this chat to see them in full.";

export type StreamTurnArgs = {
  groupId: string;
  message: string;
  /** Set to message one persona instead of everyone. */
  personaId?: string;
  /** Ids of images already uploaded for this turn. */
  fileIds?: string[];
  /**
   * False once the user has moved to another chat (the view is reused across
   * routes); replies must not be shown or spoken there.
   */
  isCurrentGroup: () => boolean;
  /** The server saved the turn and its chat is still on screen. */
  onSaved?: () => void;
  /** The turn failed and its chat is still on screen. `message` is already toasted. */
  onFailed?: (message: string) => void;
};

type UseGroupChatStreamOptions = {
  /** The view's live messages: each persona's bubble is appended and filled here. */
  setLiveMessages: Dispatch<SetStateAction<GroupMessageT[]>>;
  /**
   * Read replies aloud as they stream. Checked as each bubble appears, so
   * toggling it mid-turn affects the replies that start after the toggle.
   */
  readAloud: boolean;
};

export function useGroupChatStream({ setLiveMessages, readAloud }: UseGroupChatStreamOptions) {
  // True while a turn's replies are streaming in.
  const [isStreaming, setIsStreaming] = useState(false);
  // True from send until the first persona's reply appears; drives the
  // thinking indicator, which has no job once replies are on screen.
  const [isWaiting, setIsWaiting] = useState(false);
  // Aborts the turn in flight; also identifies which turn owns the view.
  const abortRef = useRef<(() => void) | null>(null);
  // Read inside stream callbacks, which outlive the render that started the turn.
  const readAloudRef = useRef(readAloud);
  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  /** Drop the turn in flight (navigation). The server still finishes and saves it. */
  const cancel = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setIsWaiting(false);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.();
      abortRef.current = null;
    },
    [],
  );

  /**
   * Send a turn and render each persona's reply as its tokens arrive.
   *
   * A persona's bubble appears with its first token (so there are never empty
   * bubbles, and replies show up in the order personas start speaking);
   * `persona_delta` lines append to it and `persona_done` marks it complete.
   * `done` carries the rows the server actually saved, which replace whatever
   * the deltas built up.
   *
   * With read-aloud on, each bubble is also a live utterance in the speech
   * player: the same deltas are fed to it, so a persona starts speaking about
   * one sentence after it starts typing rather than after its whole reply.
   * Utterances play in bubble order, one persona at a time.
   *
   * All per-turn bookkeeping lives in this closure, so a turn that is being
   * torn down (navigation) can never touch the state of the next one.
   */
  const send = useCallback(
    ({
      groupId,
      message: text,
      personaId,
      fileIds,
      isCurrentGroup,
      onSaved,
      onFailed,
    }: StreamTurnArgs) => {
      const controller = new AbortController();
      const bubbleOf = new Map<string, string>(); // persona_id -> bubble id
      const nameOf = new Map<string, string>(); // persona_id -> display name
      const textOf = new Map<string, string>(); // bubble id -> text so far
      const pending = new Map<string, string>(); // bubble id -> not yet rendered
      const completed = new Set<string>(); // persona_ids whose reply is whole
      const voiced = new Set<string>(); // bubble ids opened in the speech player
      // An off-topic question gets one reply for the whole group, not one per
      // persona: its bubble id, once the fallback starts streaming.
      let fallbackId: string | null = null;
      let raf: number | null = null;

      const isLive = () => !controller.signal.aborted && isCurrentGroup();

      const patchBubble = (id: string, patch: Partial<GroupMessageT>) =>
        setLiveMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

      // Deltas arrive far faster than it is worth re-rendering for, so they are
      // buffered and applied at most once per animation frame.
      const flush = () => {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
        if (pending.size === 0) return;
        const patch = new Map(pending);
        pending.clear();
        setLiveMessages((prev) =>
          prev.map((m) => {
            const add = patch.get(m.id);
            return add === undefined ? m : { ...m, message: m.message + add };
          }),
        );
      };
      const scheduleFlush = () => {
        if (raf == null) raf = requestAnimationFrame(flush);
      };

      const startVoice = (id: string, speakerKey?: string) => {
        if (!readAloudRef.current) return;
        speechPlayer.open({ id, speakerKey, groupId });
        voiced.add(id);
      };
      const voice = (id: string, delta: string) => {
        if (voiced.has(id)) speechPlayer.append(id, delta);
      };
      const endVoice = (id: string) => {
        if (voiced.has(id)) speechPlayer.end(id);
      };
      const dropVoice = (id: string) => {
        if (!voiced.delete(id)) return;
        speechPlayer.discard(id);
      };

      /** Put a new bubble on screen and, with read-aloud on, open its utterance. */
      const openBubble = (bubble: GroupMessageT, speakerKey?: string) => {
        textOf.set(bubble.id, bubble.message);
        setLiveMessages((prev) => [...prev, bubble]);
        // A reply is on screen: the thinking indicator has done its job.
        setIsWaiting(false);
        startVoice(bubble.id, speakerKey);
        if (bubble.message) voice(bubble.id, bubble.message);
      };

      /** Add streamed text to a bubble already on screen. */
      const appendTo = (id: string, delta: string) => {
        textOf.set(id, (textOf.get(id) ?? "") + delta);
        pending.set(id, (pending.get(id) ?? "") + delta);
        scheduleFlush();
        voice(id, delta);
      };

      /** The persona's bubble, created on first use. */
      const ensureBubble = (pid: string, initial = ""): string => {
        const existing = bubbleOf.get(pid);
        if (existing) return existing;
        const id = crypto.randomUUID();
        bubbleOf.set(pid, id);
        const name = nameOf.get(pid);
        openBubble({ id, role: "persona", persona_id: pid, persona_name: name, message: initial }, name);
        return id;
      };

      const appendDelta = (pid: string, delta: string) => {
        if (!delta) return;
        const id = bubbleOf.get(pid);
        if (id) appendTo(id, delta);
        else ensureBubble(pid, delta);
      };

      const appendFallback = (delta: string) => {
        if (!delta) return;
        if (fallbackId) return appendTo(fallbackId, delta);
        fallbackId = crypto.randomUUID();
        openBubble({ id: fallbackId, role: "system", message: delta });
      };

      const abort = () => {
        controller.abort();
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
      };
      abortRef.current = abort;
      setIsStreaming(true);
      setIsWaiting(true);

      streamGroupChat(
        { groupId, message: text, fileIds, personaId, signal: controller.signal },
        {
          onStart: ({ personas }) => {
            if (!isLive()) return;
            personas.forEach((p) => nameOf.set(p.persona_id, p.persona_name));
          },
          onPersonaDelta: ({ persona_id, delta, replace }) => {
            if (!isLive() || !nameOf.has(persona_id)) return;
            if (!replace) {
              appendDelta(persona_id, delta);
              return;
            }
            // The model omitted this persona: its text so far is discarded and
            // replaced wholesale by the server's placeholder — audio included.
            const existed = bubbleOf.has(persona_id);
            const id = ensureBubble(persona_id, delta);
            if (!existed) return;
            pending.delete(id);
            textOf.set(id, delta);
            patchBubble(id, { message: delta });
            if (voiced.has(id)) {
              dropVoice(id);
              startVoice(id, nameOf.get(persona_id));
              voice(id, delta);
            }
          },
          onFallbackDelta: ({ delta }) => {
            if (!isLive()) return;
            appendFallback(delta);
          },
          onPersonaDone: ({ persona_id, confidence_level }) => {
            if (!isLive()) return;
            const id = bubbleOf.get(persona_id);
            if (!id) return;
            completed.add(persona_id);
            flush();
            if (confidence_level !== undefined) patchBubble(id, { confidence_level });
            // Repeats are harmless (the server can send persona_done twice:
            // when the text ends, then with the final confidence).
            endVoice(id);
          },
          onDone: ({ responses }) => {
            touchSession(groupId);
            if (!isLive()) return;
            flush();
            // The server saves the fallback once per persona; it stays one bubble.
            if (fallbackId || (responses.length > 0 && responses.every((r) => r.is_fallback))) {
              const text = responses[0]?.response;
              if (!fallbackId) appendFallback(text ?? "");
              else if (text) patchBubble(fallbackId, { message: text });
              if (fallbackId) endVoice(fallbackId);
              onSaved?.();
              return;
            }
            const saved = new Map(responses.map((r) => [r.persona_id, r]));
            // Every saved reply gets a bubble (and its voice), even one that
            // never streamed text.
            responses.forEach((r) => {
              if (!nameOf.has(r.persona_id)) nameOf.set(r.persona_id, r.persona_name);
              const id = ensureBubble(r.persona_id);
              if (!textOf.get(id)) voice(id, r.response);
            });
            const byBubble = new Map(
              [...bubbleOf.entries()].map(([pid, id]) => [id, saved.get(pid)]),
            );
            setLiveMessages((prev) =>
              prev.flatMap((m) => {
                if (!byBubble.has(m.id)) return [m];
                const reply = byBubble.get(m.id);
                // Streamed but not saved: it will not be in history, so drop it.
                if (!reply) return [];
                return [
                  {
                    ...m,
                    persona_id: reply.persona_id,
                    persona_name: reply.persona_name,
                    message: reply.response,
                    evidence_tags: reply.evidence_tags,
                    confidence_level: reply.confidence_level,
                    confidence_score: reply.confidence_score,
                  },
                ];
              }),
            );
            byBubble.forEach((reply, id) => (reply ? endVoice(id) : dropVoice(id)));
            onSaved?.();
          },
          onError: (message, { interrupted }) => {
            if (!isLive()) return;
            flush();
            // A turn the server rejected or failed was not saved, so none of its
            // text should stay. A dropped connection is different: the server
            // still finishes and saves the turn, so replies that completed are
            // kept and only the cut-off ones are removed.
            const keep = new Set(
              interrupted
                ? [...completed].map((pid) => bubbleOf.get(pid)).filter(Boolean)
                : [],
            );
            // A fallback only counts once `done` confirms it, so it always goes.
            const bubbles = [...bubbleOf.values(), ...(fallbackId ? [fallbackId] : [])];
            const drop = new Set(bubbles.filter((id) => !keep.has(id)));
            if (drop.size > 0) {
              setLiveMessages((prev) => prev.filter((m) => !drop.has(m.id)));
            }
            // Cut-off replies stop mid-sentence; finished ones are read to the end.
            bubbles.forEach((id) => (drop.has(id) ? dropVoice(id) : endVoice(id)));
            toast.error(interrupted ? STREAM_INTERRUPTED_SAVED_MESSAGE : message);
            onFailed?.(message);
          },
        },
      ).finally(() => {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
        // Only the turn that still owns the view may clear the streaming state.
        if (abortRef.current !== abort) return;
        abortRef.current = null;
        setIsStreaming(false);
        setIsWaiting(false);
      });
    },
    [setLiveMessages],
  );

  return { send, cancel, isStreaming, isWaiting };
}
