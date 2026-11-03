import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MicStatus } from "@/hooks/useMicRecorder";

const BAR_COUNT = 32;
/** Below this much time left the timer turns amber. */
const WARN_REMAINING_MS = 10_000;

const TRANSCRIBING_LINES = [
  "Transcribing your voice…",
  "Turning speech into text…",
  "Picking out every word…",
  "Adding punctuation…",
  "Almost there…",
];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Milliseconds since `running` last turned true, ticking while it stays true.
 * Keeps the final value once it stops, so the clip length can still be shown
 * while it's transcribed.
 */
function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  // Restart from zero the moment a new run begins (state adjusted during
  // render, so the old value never flashes).
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (running) setElapsed(0);
  }
  useEffect(() => {
    if (!running) return;
    const startedAt = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [running]);
  return elapsed;
}

/**
 * Live input levels (0..1) for `stream`, one per bar. Returns null where Web
 * Audio isn't available, so the caller can fall back to a decorative wave.
 */
function useAudioLevels(stream: MediaStream | null, bars: number) {
  const [levels, setLevels] = useState<number[] | null>(null);

  useEffect(() => {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!stream || !Ctx) return;

    let ctx: AudioContext;
    let source: MediaStreamAudioSourceNode;
    try {
      ctx = new Ctx();
      source = ctx.createMediaStreamSource(stream);
    } catch {
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    // Voice sits in the lower bins; skip the very top where there's only hiss.
    const usable = Math.floor(data.length * 0.7);
    const perBar = Math.max(1, Math.floor(usable / bars));
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 50) return; // ~20fps is plenty for a meter
      last = now;
      analyser.getByteFrequencyData(data);
      const next: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < perBar; j++) sum += data[i * perBar + j] ?? 0;
        next.push(Math.min(1, sum / perBar / 200));
      }
      setLevels(next);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
      void ctx.close().catch(() => {});
    };
  }, [stream, bars]);

  return stream ? levels : null;
}

function Waveform({ stream }: { stream: MediaStream | null }) {
  const levels = useAudioLevels(stream, BAR_COUNT);
  return (
    <div
      aria-hidden
      className="flex h-5 min-w-0 flex-1 items-center gap-[3px] overflow-hidden"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const level = levels?.[i];
        return (
          <span
            key={i}
            className={cn(
              "w-[2px] shrink-0 rounded-full bg-foreground/35 transition-[height] duration-75",
              level === undefined &&
                "h-full origin-center animate-[wave-bars_1.1s_ease-in-out_infinite]",
            )}
            style={
              level === undefined
                ? { animationDelay: `${(i % 7) * -0.15}s`, opacity: 0.35 + ((i * 37) % 60) / 100 }
                : { height: `${Math.max(12, level * 100)}%` }
            }
          />
        );
      })}
    </div>
  );
}

function RotatingLine({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % lines.length), 1800);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    // Keyed so each new line slides in; the shimmer lives on the inner span
    // because both are CSS animations.
    <span
      key={index}
      className="block duration-300 animate-in fade-in slide-in-from-bottom-1"
    >
      <span
        className={cn(
          "block truncate text-sm font-medium",
          "bg-[linear-gradient(to_right,var(--muted-foreground)_40%,var(--foreground)_60%,var(--muted-foreground)_80%)]",
          "bg-size-[200%_auto] bg-clip-text text-transparent animate-[shimmer_3s_infinite_linear]",
        )}
      >
        {lines[index]}
      </span>
    </span>
  );
}

type VoiceStatusBarProps = {
  status: MicStatus;
  stream: MediaStream | null;
  maxDurationMs: number;
  /** Throw the clip (or the transcription in flight) away. */
  onDiscard: () => void;
};

/**
 * One quiet line that stands in for the composer's textarea while the mic is
 * in use: a permission hint, then a countdown + live wave while recording, then a
 * rotating message while the clip is transcribed. Escape discards at any stage.
 */
function VoiceStatusBar({
  status,
  stream,
  maxDurationMs,
  onDiscard,
}: VoiceStatusBarProps) {
  const recording = status === "recording";
  // Holds its last value after recording stops: that's the clip length.
  const elapsed = useElapsed(recording);

  useEffect(() => {
    if (status === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDiscard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, onDiscard]);

  if (status === "idle") return null;

  // The timer counts down to the automatic stop.
  const remaining = Math.max(0, maxDurationMs - elapsed);
  const nearLimit = recording && remaining <= WARN_REMAINING_MS;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full min-h-[44px] items-center gap-3 pl-4 pr-2 duration-200 animate-in fade-in"
    >
      {status === "requesting" && (
        <span className="animate-pulse text-sm text-muted-foreground">
          Starting microphone…
        </span>
      )}

      {recording && (
        <>
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60" />
            <span className="relative size-2 rounded-full bg-destructive" />
          </span>
          <span
            data-testid="recording-timer"
            className={cn(
              "shrink-0 text-sm tabular-nums",
              nearLimit ? "text-amber-600 dark:text-amber-400" : "text-foreground",
            )}
            title={`Recording stops automatically at ${formatClock(maxDurationMs)}`}
          >
            {formatClock(Math.ceil(remaining / 1000) * 1000)}
          </span>
          <span className="sr-only">Listening</span>
          <Waveform stream={stream} />
        </>
      )}

      {status === "transcribing" && (
        <div className="min-w-0 flex-1">
          <RotatingLine lines={TRANSCRIBING_LINES} />
        </div>
      )}

      <button
        type="button"
        onClick={onDiscard}
        aria-label={status === "transcribing" ? "Cancel transcription" : "Discard recording"}
        title="Discard (Esc)"
        className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default VoiceStatusBar;
