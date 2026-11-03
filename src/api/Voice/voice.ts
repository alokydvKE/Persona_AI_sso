import { useQuery } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";
import { getNetworkErrorMessage } from "@/lib/apiError";
import {
  apiUrl,
  envelopeFailure,
  jsonAuthHeaders,
  storeRefreshedToken,
} from "@/lib/streamFetch";
import { chunkFrames, createPcm16Decoder, parseWav, type AudioChunk } from "@/lib/voice/pcm";
import { VOICE_ENDPOINTS } from "./endpoints";

/** Only what the UI needs; provider details stay on the backend. */
export type VoiceConfig = {
  stt: { enabled: boolean };
  tts: { enabled: boolean };
  /** Longest clip the backend transcribes (VOICE_MAX_RECORDING_SECONDS). */
  limits?: { max_recording_seconds?: number };
};

export type TranscriptionResult = {
  text: string;
  duration_seconds: number | null;
  latency_ms: number;
};

export const voiceConfigKey = ["VoiceConfig"] as const;

/**
 * Voice config (VOICE_ENDPOINTS.config) — whether speech-to-text / text-to-speech are available.
 * Failing quietly just hides the voice controls, so no toast.
 */
export const useVoiceConfig = () => {
  const token = getAuthToken();
  return useQuery({
    queryKey: voiceConfigKey,
    queryFn: () => postApi<VoiceConfig>(VOICE_ENDPOINTS.config, { token }, { silent: true }),
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: false,
  });
};

/** Speech to text (VOICE_ENDPOINTS.stt) — transcribe one recorded clip. Errors are toasted. */
export function transcribeAudio(
  audio: Blob,
  filename: string,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append("token", getAuthToken());
  form.append("audio", audio, filename);
  return postApi<TranscriptionResult>(
    VOICE_ENDPOINTS.stt,
    form as unknown as Record<string, unknown>,
    { signal, timeoutMs: 60_000 },
  );
}

/** Longest silence tolerated inside a streamed clip before giving up on it. */
export const SPEECH_STREAM_IDLE_TIMEOUT_MS = 30_000;

export type SpeechStreamArgs = {
  text: string;
  /** Persona name: picks (and keeps) the persona's voice. */
  speakerKey?: string;
  /** Group chat the speaker is in: lets the backend use the persona's stored voice. */
  groupId?: string;
  /** Say the persona's name before the text. Only the first piece of a reply does. */
  announce?: boolean;
  signal?: AbortSignal;
  /** Receives decoded audio as it arrives, in order. */
  onChunk: (chunk: AudioChunk) => void;
};

/**
 * Text to speech (VOICE_ENDPOINTS.tts), streamed.
 *
 * Asks for raw PCM (`stream: true`) and hands each decoded piece to `onChunk`
 * while the rest is still being synthesized, so playback can start after the
 * first few hundred milliseconds instead of after the whole clip. When the
 * backend can't stream (provider unavailable) it answers with a complete WAV
 * instead, which is decoded and delivered as a single chunk — callers never
 * need to know which happened.
 *
 * Resolves once the clip is complete; rejects with a user-facing message on
 * failure, or with an AbortError when `signal` aborts. Silent: callers decide
 * how to report failures. A clip that produced no audio at all is a failure.
 */
export async function streamSpeech({
  text,
  speakerKey,
  groupId,
  announce = true,
  signal,
  onChunk,
}: SpeechStreamArgs): Promise<void> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) throw abortError();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  let stalled = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armWatchdog = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, SPEECH_STREAM_IDLE_TIMEOUT_MS);
  };
  let delivered = false;
  const deliver = (chunk: AudioChunk | null) => {
    if (!chunk || chunkFrames(chunk) === 0) return;
    delivered = true;
    onChunk(chunk);
  };

  try {
    armWatchdog();
    const res = await fetch(apiUrl(VOICE_ENDPOINTS.tts), {
      method: "POST",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({
        token: getAuthToken(),
        text,
        speaker_key: speakerKey || undefined,
        group_id: groupId || undefined,
        announce,
        stream: true,
      }),
      signal: controller.signal,
    });
    storeRefreshedToken(res);

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!res.ok || contentType.includes("json") || !res.body) {
      throw new Error((await envelopeFailure(res)).message);
    }

    if (contentType.includes("wav")) {
      // Buffered fallback: one complete file.
      deliver(parseWav(await res.arrayBuffer()));
    } else {
      const format = res.headers.get("x-sf") ?? "s16le";
      if (format !== "s16le") throw new Error(`Unsupported audio format: ${format}`);
      const decoder = createPcm16Decoder(
        Number(res.headers.get("x-sr") ?? 24_000),
        Number(res.headers.get("x-ch") ?? 1),
      );
      const reader = res.body.getReader();
      // Not every fetch implementation errors a pending read on abort once the
      // headers are in; cancelling the reader always ends it.
      const cancelRead = () => void reader.cancel().catch(() => undefined);
      if (controller.signal.aborted) cancelRead();
      else controller.signal.addEventListener("abort", cancelRead, { once: true });
      for (;;) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) throw abortError();
        if (done) break;
        armWatchdog();
        deliver(decoder.push(value));
      }
    }
  } catch (error) {
    if (stalled) throw new Error(TTS_FAILED, { cause: error });
    if (signal?.aborted || controller.signal.aborted) throw abortError();
    if (error instanceof Error && !(error instanceof TypeError)) throw error;
    // TypeError = fetch's network failure.
    throw new Error(getNetworkErrorMessage(), { cause: error });
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener("abort", forwardAbort);
  }
  if (!delivered) throw new Error(TTS_FAILED);
}

const TTS_FAILED = "Couldn't play this reply aloud.";

function abortError(): Error {
  const error = new Error("Request was cancelled");
  error.name = "AbortError";
  return error;
}
