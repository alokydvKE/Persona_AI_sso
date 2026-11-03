import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, Database, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useDataFilePipelineJob,
  type DataPipelineStep,
} from "@/api/Projects/dataFiles";

type Props = {
  jobId: string;
  /**
   * True when this run was already in flight before the page loaded — the user
   * closed the tab and came back. Only changes the copy: "still processing"
   * rather than implying they just started it.
   */
  resumed?: boolean;
  /** Fired once when the pipeline finishes successfully. */
  onComplete?: () => void;
  /** Fired once when the pipeline fails. */
  onError?: () => void;
};

/**
 * Loader shown while the file_pipeline background job runs. Polls
 * /projects/job-status (via {@link useDataFilePipelineJob}) and calls
 * onComplete / onError exactly once when the job settles. Renders a live
 * per-step stepper from the job's `steps` (each step carries a "done / total
 * files" count), falling back to an indeterminate sweep when steps are absent.
 * Visual twin of the persona-build progress card.
 */
function DataPipelineProgress({
  jobId,
  resumed = false,
  onComplete,
  onError,
}: Props) {
  const { data, isError } = useDataFilePipelineJob(jobId);

  const status = data?.status ?? "running";
  const failed = status === "failed" || isError;
  const done = status === "done" && !isError;
  const running = !failed && !done;
  const steps = data?.steps ?? null;
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const progress = data?.progress ?? 0;

  // Fire onComplete / onError exactly once when the job settles.
  const settledRef = useRef(false);
  useEffect(() => {
    if (settledRef.current) return;
    if (status === "done") {
      settledRef.current = true;
      onComplete?.();
    } else if (failed) {
      settledRef.current = true;
      onError?.();
    }
  }, [status, failed, onComplete, onError]);

  const shownPercent = failed ? 100 : Math.min(Math.max(progress, 0), 100);

  return (
    // Fills its container rather than floating: this replaces the dropzone
    // inside the page's card, so a second bordered card capped narrower than the
    // panel around it just reads as a small box adrift in a big empty one.
    <div className="w-full duration-300 animate-in fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Database className={cn("h-5 w-5", running && "animate-pulse")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {failed
              ? "Couldn't process your data"
              : done
                ? "Data processed"
                : resumed
                  ? "Still processing your data…"
                  : "Processing your data…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {failed
              ? "Something went wrong while processing the uploaded files."
              : done
                ? "Your data is ready. Taking you to the persona builder…"
                : resumed
                  ? "This run was already going — you can leave this page and come back."
                  : "Analysing your uploaded files — this can take a moment."}
          </p>
        </div>
        {/* The percentage leads, in the same row as the heading, so the number
            has a home other than the bar itself. */}
        {hasSteps && !failed && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {shownPercent}%
          </span>
        )}
        {running && !hasSteps && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Progress bar: determinate when steps report a percentage, else an
          indeterminate sweep. Rose + full when failed. Full-bleed across the
          panel — it is the primary thing on this screen while a run is going. */}
      <div
        className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasSteps && !failed ? shownPercent : undefined}
        aria-label="Data processing progress"
      >
        {failed ? (
          <div className="h-full w-full rounded-full bg-rose-500" />
        ) : hasSteps ? (
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
            // Floored at 4% so a run that has just started still reads as
            // started rather than as an empty track.
            style={{ width: `${Math.max(shownPercent, 4)}%` }}
          />
        ) : (
          <div className="absolute top-0 h-full w-2/5 rounded-full bg-foreground/70 animate-[loader-sweep_1.4s_ease-in-out_infinite]" />
        )}
      </div>

      {hasSteps && (
        <ul className="mt-5 space-y-3 border-t pt-4">
          {steps!.map((step) => (
            <StepRow key={step.key} step={step} jobFailed={failed} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One row of the pipeline stepper: status icon + label + "x / total" file count. */
function StepRow({
  step,
  jobFailed,
}: {
  step: DataPipelineStep;
  jobFailed: boolean;
}) {
  const status = jobFailed && step.status !== "done" ? "failed" : step.status;
  const isDone = status === "done";
  const isRunning = status === "running";
  const isFailed = status === "failed";

  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
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

      {/* Per-step file count, only meaningful with more than one file. */}
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

export default DataPipelineProgress;
