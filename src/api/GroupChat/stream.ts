import { getAuthToken } from "@/lib/api";
import { getApiErrorMessage, getNetworkErrorMessage } from "@/lib/apiError";
import {
  apiUrl,
  envelopeFailure,
  jsonAuthHeaders,
  storeRefreshedToken,
} from "@/lib/streamFetch";

/**
 * NDJSON streaming client for group chat.
 *
 * Why this exists instead of another `postApi` call: the app's HTTP layer is
 * axios (see services/apiService.ts), and axios is built on XHR, which only
 * exposes a response body once it is *complete*. Reading a response as it
 * arrives requires `fetch` + `res.body.getReader()`, so the streamed endpoints
 * get their own small client rather than going through react-query. It mirrors
 * what the axios layer does for every other call (see lib/streamFetch.ts).
 *
 * The backend answers `application/x-ndjson`: one JSON object per line. Each
 * line is independently parseable, which is what lets several personas' events
 * interleave on a single connection.
 *
 * This file is the wire protocol only; `./useGroupChatStream.ts` turns these
 * events into chat bubbles and read-aloud audio.
 */

/**
 * Longest silence tolerated on an open stream. The backend sends a `ping` line
 * whenever it has been quiet for 15s, so a gap this long means the connection
 * is dead (proxy dropped it, laptop slept) rather than the model being slow.
 */
export const STREAM_IDLE_TIMEOUT_MS = 60_000;

export const STREAM_INTERRUPTED_MESSAGE =
  "The connection dropped before the reply finished. Please try again.";

/** One persona's reply as the server saved it (carried by the `done` event). */
export type SavedPersonaReply = {
  persona_id: string;
  persona_name: string;
  response: string;
  evidence_tags: string[];
  confidence_level?: string | null;
  confidence_score?: number | null;
  /** 1 when the personas didn't answer and this is the shared fallback text. */
  is_fallback?: number | boolean;
};

export type StreamStart = {
  type: "start";
  personas: { persona_id: string; persona_name: string }[];
};
export type StreamPersonaDelta = {
  type: "persona_delta";
  persona_id: string;
  delta: string;
  /** Set when the text so far must be discarded and replaced (omitted persona). */
  replace?: boolean;
};
export type StreamPersonaDone = {
  type: "persona_done";
  persona_id: string;
  confidence_level?: string | null;
};
export type StreamFallbackDelta = { type: "fallback_delta"; delta: string };
export type StreamDone = {
  type: "done";
  /** The persisted rows — authoritative over whatever the deltas built up. */
  responses: SavedPersonaReply[];
  images?: { file_id: string; file_name: string; s3_key: string }[];
};
export type StreamError = { type: "error"; message: string };
/** Keep-alive sent during idle gaps; carries no data. */
export type StreamPing = { type: "ping" };

export type StreamEvent =
  | StreamStart
  | StreamPersonaDelta
  | StreamPersonaDone
  | StreamFallbackDelta
  | StreamDone
  | StreamError
  | StreamPing;

export type StreamErrorInfo = {
  /** Envelope / HTTP status when the server rejected the send outright. */
  code?: number;
  /**
   * The stream broke after it started (dropped connection, stall, garbled
   * body). The backend finishes and persists a turn even when the client goes
   * away, so the caller should re-sync history rather than assume nothing
   * was saved.
   */
  interrupted?: boolean;
};

export type StreamHandlers = {
  onStart?: (e: StreamStart) => void;
  onPersonaDelta?: (e: StreamPersonaDelta) => void;
  onPersonaDone?: (e: StreamPersonaDone) => void;
  onFallbackDelta?: (e: StreamFallbackDelta) => void;
  onDone?: (e: StreamDone) => void;
  /** User-facing message; the caller decides how to show it. */
  onError?: (message: string, info: StreamErrorInfo) => void;
};

export type StreamArgs = {
  groupId: string;
  message: string;
  fileIds?: string[];
  /** Set to reply to one persona instead of broadcasting. */
  personaId?: string;
  signal?: AbortSignal;
};

const isString = (v: unknown): v is string => typeof v === "string";

/**
 * Narrow one parsed line to a known event, or null. A line that parses but has
 * the wrong shape is dropped rather than trusted: a handler must never see a
 * `persona_delta` without a string `delta`.
 */
function toEvent(raw: unknown): StreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  switch (e.type) {
    case "start":
      return Array.isArray(e.personas)
        ? {
            type: "start",
            personas: e.personas.filter(
              (p): p is StreamStart["personas"][number] =>
                !!p && isString(p.persona_id) && isString(p.persona_name),
            ),
          }
        : null;
    case "persona_delta":
      return isString(e.persona_id) && isString(e.delta) ? (e as StreamPersonaDelta) : null;
    case "persona_done":
      return isString(e.persona_id) ? (e as StreamPersonaDone) : null;
    case "fallback_delta":
      return isString(e.delta) ? (e as StreamFallbackDelta) : null;
    case "done":
      return Array.isArray(e.responses) ? (e as StreamDone) : null;
    case "error":
      return { type: "error", message: isString(e.message) ? e.message : "" };
    case "ping":
      return { type: "ping" };
    default:
      return null;
  }
}

/**
 * Send one group-chat turn and report its reply as it streams.
 *
 * Contract: never rejects. Exactly one of `onDone` / `onError` is called —
 * unless `signal` aborts, in which case neither is (a cancel is the caller's
 * own decision, not a failure to report).
 *
 * Validation failures (missing group, ended chat, expired session) are found
 * before generation starts and come back as the ordinary JSON envelope, not as
 * a stream, so a non-NDJSON response is unwrapped and reported via `onError`.
 */
export async function streamGroupChat(
  { groupId, message, fileIds, personaId, signal }: StreamArgs,
  handlers: StreamHandlers,
): Promise<void> {
  if (signal?.aborted) return;

  const path = personaId
    ? "persona/group-chat/message-single/stream"
    : "persona/group-chat/message/stream";

  const body: Record<string, unknown> = {
    token: getAuthToken(),
    group_id: groupId,
    message,
    ...(personaId ? { persona_id: personaId } : { flow: "message" }),
    ...(fileIds && fileIds.length > 0 ? { file_ids: fileIds } : {}),
  };

  // One controller drives the fetch: aborted by the caller's signal, or by the
  // idle watchdog. `stalled` tells the two apart afterwards.
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  let stalled = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armWatchdog = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };

  let settled = false;
  let started = false;
  const fail = (text: string, info: StreamErrorInfo = {}) => {
    if (settled) return;
    settled = true;
    handlers.onError?.(text, info);
  };

  const dispatch = (event: StreamEvent) => {
    if (settled) return; // nothing is reported after the terminal event
    switch (event.type) {
      case "start":
        started = true;
        return handlers.onStart?.(event);
      case "persona_delta":
        return handlers.onPersonaDelta?.(event);
      case "persona_done":
        return handlers.onPersonaDone?.(event);
      case "fallback_delta":
        return handlers.onFallbackDelta?.(event);
      case "done":
        settled = true;
        return handlers.onDone?.(event);
      case "error":
        return fail(getApiErrorMessage(500, event.message));
      case "ping":
        return;
    }
  };

  const dispatchLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // One garbled line must not take down the rest of the turn.
      console.warn("[group-chat stream] skipped a malformed line");
      return;
    }
    const event = toEvent(parsed);
    if (event) dispatch(event);
  };

  try {
    armWatchdog();
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: jsonAuthHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    storeRefreshedToken(res);

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("x-ndjson") || !res.body) {
      // A pre-generation rejection is a normal envelope, not a stream.
      const { code, message: text } = await envelopeFailure(res);
      return fail(text, { code });
    }

    const reader = res.body.getReader();
    // Not every fetch implementation errors a pending read when its request is
    // aborted after the headers arrived; cancelling the reader always ends it.
    const cancelRead = () => void reader.cancel().catch(() => undefined);
    if (controller.signal.aborted) cancelRead();
    else controller.signal.addEventListener("abort", cancelRead, { once: true });
    const decoder = new TextDecoder();
    // Chunk boundaries land mid-line constantly, so an incomplete trailing line
    // is carried over to the next read instead of being parsed.
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) {
        // A cancel is silent; a stall is a dead connection worth reporting.
        if (stalled) fail(STREAM_INTERRUPTED_MESSAGE, { interrupted: started });
        return;
      }
      if (done) break;
      armWatchdog();
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        dispatchLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
      if (settled) {
        // Nothing meaningful follows the terminal event; release the socket.
        await reader.cancel().catch(() => undefined);
        return;
      }
    }
    buffer += decoder.decode();
    dispatchLine(buffer);

    // The body ended without `done` or `error`: the connection was cut.
    fail(STREAM_INTERRUPTED_MESSAGE, { interrupted: started });
  } catch (err) {
    if (signal?.aborted && !stalled) return; // the caller cancelled
    if (stalled) return fail(STREAM_INTERRUPTED_MESSAGE, { interrupted: started });
    // A throwing handler is a bug, but the turn still has to end cleanly.
    if (!(err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError"))) {
      console.error("[group-chat stream] failed", err);
    }
    fail(started ? STREAM_INTERRUPTED_MESSAGE : getNetworkErrorMessage(), { interrupted: started });
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
