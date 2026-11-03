import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { transcribeAudio } from "@/api/Voice/voice";

export type MicStatus = "idle" | "requesting" | "recording" | "transcribing";

/**
 * Fallback only: the real limit is the backend's VOICE_MAX_RECORDING_SECONDS,
 * read from the voice config endpoint. Used until that config has loaded.
 */
export const MAX_RECORDING_MS = 30 * 1000;
export const MIN_RECORDING_MS = 500;

// Preferred first; Safari only records mp4.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/webm",
];

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function pickRecordingMimeType(): string | undefined {
  const isTypeSupported = window.MediaRecorder?.isTypeSupported;
  if (typeof isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((type) => {
    try {
      return window.MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export function recordingFilename(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return `recording.${EXTENSIONS[base] ?? "webm"}`;
}

export function micErrorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "Microphone access is blocked. Allow it in your browser settings to use voice input.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No microphone was found.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "Your microphone is being used by another app.";
    default:
      return "Couldn't start the microphone.";
  }
}

type Options = {
  /** Receives the trimmed transcript; never called with empty text. */
  onTranscript: (text: string) => void;
  maxDurationMs?: number;
  minDurationMs?: number;
};

/**
 * Tap to record, tap again to stop; the clip is sent for transcription and the
 * text handed to `onTranscript`. Owns the microphone stream and always releases
 * it — on stop, cancel, error and unmount. `cancel` also drops a transcription
 * in progress so its result never lands somewhere stale.
 */
export function useMicRecorder({
  onTranscript,
  maxDurationMs = MAX_RECORDING_MS,
  minDurationMs = MIN_RECORDING_MS,
}: Options) {
  const [status, setStatus] = useState<MicStatus>("idle");
  // The live input, exposed so the UI can draw a level meter while recording.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const supported = isRecordingSupported();

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const statusRef = useRef<MicStatus>("idle");
  const sessionRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = useCallback((next: MicStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const release = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const transcribe = useCallback(
    async (session: number, blob: Blob) => {
      update("transcribing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { text } = await transcribeAudio(
          blob,
          recordingFilename(blob.type),
          controller.signal,
        );
        if (session !== sessionRef.current) return;
        const transcript = (text ?? "").trim();
        if (transcript) onTranscriptRef.current(transcript);
        else toast.error("We didn't catch that. Please try again.");
      } catch {
        // Server and transport errors are toasted by the API layer; a cancelled
        // request needs no message.
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (session === sessionRef.current) update("idle");
      }
    },
    [update],
  );

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    if (!supported) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    const session = ++sessionRef.current;
    update("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (session === sessionRef.current) {
        toast.error(micErrorMessage(error));
        update("idle");
      }
      return;
    }
    if (session !== sessionRef.current) {
      // Cancelled while the permission prompt was open.
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    const preferred = pickRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        release();
        toast.error(micErrorMessage(error));
        update("idle");
        return;
      }
    }

    const chunks: Blob[] = [];
    let startedAt = 0;
    let hitLimit = false;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (session !== sessionRef.current) return;
      sessionRef.current += 1;
      release();
      recorderRef.current = null;
      toast.error("Recording failed. Please try again.");
      update("idle");
    };
    recorder.onstop = () => {
      release();
      recorderRef.current = null;
      if (session !== sessionRef.current) return;

      const duration = Date.now() - startedAt;
      const type = recorder.mimeType || preferred || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (duration < minDurationMs || blob.size === 0) {
        toast.error("That recording was too short. Hold on a little longer.");
        update("idle");
        return;
      }
      if (hitLimit) {
        const limit =
          maxDurationMs < 60_000
            ? `${Math.round(maxDurationMs / 1000)} seconds`
            : `${Math.round(maxDurationMs / 60_000)} minutes`;
        toast.info?.(`Recording stops after ${limit}.`);
      }
      void transcribe(session, blob);
    };

    try {
      recorder.start();
    } catch (error) {
      release();
      toast.error(micErrorMessage(error));
      update("idle");
      return;
    }
    recorderRef.current = recorder;
    setStream(stream);
    startedAt = Date.now();
    timerRef.current = setTimeout(() => {
      hitLimit = true;
      if (recorder.state === "recording") recorder.stop();
    }, maxDurationMs);
    update("recording");
  }, [maxDurationMs, minDurationMs, release, supported, transcribe, update]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    release();
    if (statusRef.current !== "idle") update("idle");
  }, [release, update]);

  const toggle = useCallback(() => {
    if (statusRef.current === "recording") stop();
    else if (statusRef.current === "idle") void start();
  }, [start, stop]);

  // Never leave the microphone on after the view goes away.
  useEffect(
    () => () => {
      sessionRef.current += 1;
      abortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Already stopped.
        }
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return { status, stream, maxDurationMs, supported, start, stop, toggle, cancel };
}
