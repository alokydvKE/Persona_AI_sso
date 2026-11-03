import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN, CHAT_INSET } from "./chatLayout";
import {
  usePersonaBuildJob,
  type PersonaBuildStep,
  type RunQueryPersona,
} from "@/api/Persona/query";
import type { BuilderBuildSnapshot } from "@/api/Chat/query";

type PersonaBuildProgressProps = {
  jobId: string;
  /**
   * Persisted snapshot from /chat/history. Used to seed the job query so a
   * reopened chat renders the build's real (often already-done) state at once —
   * no "Building…" loader flash before the first /job-status poll resolves.
   */
  snapshot?: BuilderBuildSnapshot;
  /**
   * Fired once when the job finishes successfully, with its run_query output.
   * Omitted when the card is rehydrated from history for an already-settled
   * build, so reopening an old conversation never re-toasts or re-opens the
   * dashboard — the card just shows the final state.
   */
  onComplete?: (personas: RunQueryPersona[]) => void;
  /** Fired once when the job fails. */
  onError?: () => void;
  /** Open the persona dashboard regardless of job state. */
  onViewPersonas?: () => void;
  /** Whether this build's results panel is open (drives the toggle's state). */
  resultsOpen?: boolean;
  /** Open/close this build's results panel; offered once the build has settled. */
  onToggleResults?: () => void;
};

/**
 * Loader shown while the persona_query (run_query) background job runs. Polls
 * /projects/job-status (via {@link usePersonaBuildJob}) and calls onComplete /
 * onError exactly once when the job settles, so the parent can open the
 * dashboard.
 *
 * When the job reports `steps`, it renders a live per-step stepper (each step
 * carries a "done / total personas" count); otherwise it falls back to a plain
 * indeterminate loader.
 */
function PersonaBuildProgress({
  jobId,
  snapshot,
  onComplete,
  onError,
  onViewPersonas,
  resultsOpen = false,
  onToggleResults,
}: PersonaBuildProgressProps) {
  // The history snapshot omits the heavy run_query `result` — the card doesn't
  // need it, so seed it as null.
  const { data, isError } = usePersonaBuildJob(
    jobId,
    snapshot ? { ...snapshot, result: null } : undefined,
  );

  const status = data?.status ?? "running";
  const failed = status === "failed" || isError;
  // The card now stays in the transcript after the job settles, so it must read
  // as a finished record — not perpetually "building" — once done.
  const done = status === "done" && !isError;
  const running = !failed && !done;
  const steps = data?.steps ?? null;
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const progress = data?.progress ?? 0;
  // Finishing while on screen earns one soft glow; a build that was already
  // done when the card appeared (a reopened chat) just shows its result.
  const [doneAtMount] = useState(done);
  const celebrate = done && !doneAtMount;

  // Fire onComplete / onError exactly once when the job settles.
  const settledRef = useRef(false);
  useEffect(() => {
    if (settledRef.current) return;
    if (status === "done") {
      settledRef.current = true;
      onComplete?.(data?.result?.personas ?? []);
    } else if (failed) {
      settledRef.current = true;
      onError?.();
    }
  }, [status, failed, data?.result?.personas, onComplete, onError]);

  return (
    // As wide as the chat's composer / ended bar, so their edges line up.
    <div className={cn(CHAT_COLUMN, CHAT_INSET)}>
      <div
        data-celebrate={celebrate || undefined}
        className={cn(
          "w-full rounded-xl border bg-card p-5 shadow-sm duration-300 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none",
          celebrate && "animate-[success-pulse_1.4s_ease-out_2]",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Settings className={cn("h-5 w-5", running && "animate-spin")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {failed
                ? "Couldn't build your personas"
                : done
                  ? "Personas built"
                  : "Building Your Personas…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {failed
                ? "Something went wrong while analysing the data."
                : done
                  ? "Your personas are ready."
                  : "Analysing your survey data — this can take a moment."}
            </p>
          </div>
          {running && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
          )}
          {/* A failed build still created its personas, so both outcomes offer them. */}
          {!running && onToggleResults && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={cn(
                    "shrink-0 rounded-lg text-muted-foreground hover:text-foreground",
                    resultsOpen && "bg-muted text-foreground",
                  )}
                  aria-label={resultsOpen ? "Hide build results" : "View build results"}
                  aria-expanded={resultsOpen}
                  onClick={onToggleResults}
                >
                  {resultsOpen ? (
                    <PanelRightClose className="size-5" aria-hidden="true" />
                  ) : (
                    <PanelRightOpen className="size-5" aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{resultsOpen ? "Hide build results" : "View build results"}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Progress bar: determinate when steps report a percentage, else an
            indeterminate transform-based sweep. Rose + full when failed. */}
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
          {failed ? (
            <div className="h-full w-full rounded-full bg-rose-500" />
          ) : hasSteps ? (
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
              style={{ width: `${Math.min(Math.max(progress, 4), 100)}%` }}
            />
          ) : (
            <div className="absolute top-0 h-full w-2/5 rounded-full bg-foreground/70 animate-[loader-sweep_1.4s_ease-in-out_infinite]" />
          )}
        </div>

        {hasSteps && (
          <ul className="mt-4 space-y-2.5">
            {steps!.map((step) => (
              <StepRow key={step.key} step={step} jobFailed={failed} />
            ))}
          </ul>
        )}

        {failed && onViewPersonas && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={onViewPersonas}>
              View personas anyway
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One row of the build stepper: status icon + label + "x / total" persona count. */
function StepRow({
  step,
  jobFailed,
}: {
  step: PersonaBuildStep;
  jobFailed: boolean;
}) {
  // If the whole job failed, steps still mid-flight read as failed rather than
  // spinning forever.
  const status =
    jobFailed && step.status !== "done" ? "failed" : step.status;
  const isDone = status === "done";
  const isRunning = status === "running";
  const isFailed = status === "failed";
  // A step finishing while on screen pops its check in; one already done when
  // the card appeared shows it plainly.
  const [doneAtMount] = useState(isDone);
  const popped = isDone && !doneAtMount;

  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isDone ? (
          <CheckCircle2
            data-popped={popped || undefined}
            className={cn(
              "h-5 w-5 text-emerald-500",
              popped && "duration-300 animate-in zoom-in-50 fade-in motion-reduce:animate-none",
            )}
          />
        ) : isFailed ? (
          <XCircle className="h-5 w-5 text-rose-500" />
        ) : isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin text-foreground" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </span>

      <span
        className={cn(
          "flex-1 truncate",
          isDone && "text-foreground",
          isRunning && "font-medium text-foreground",
          isFailed && "text-rose-600",
          status === "pending" && "text-muted-foreground",
        )}
      >
        {step.label}
      </span>

      {/* Per-step persona count, only meaningful with more than one persona. */}
      {step.total > 1 && (
        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
          {Math.min(step.done, step.total)}/{step.total}
          {step.failed > 0 && (
            <span className="ml-1 text-rose-500">· {step.failed} failed</span>
          )}
        </span>
      )}
    </li>
  );
}

export default PersonaBuildProgress;
