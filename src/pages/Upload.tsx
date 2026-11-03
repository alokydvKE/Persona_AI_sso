import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GradientRingLoader, TextShimmerLoader } from "@/components/ui/loader";
import DataFileDropzone from "@/components/common/Upload/DataFileDropzone";
import DataPipelineProgress from "@/components/common/Upload/DataPipelineProgress";
// import RequiredFormatCard from "@/components/common/Upload/RequiredFormatCard";
import { useDataFileSelection } from "@/hooks/useDataFileSelection";
import {
  uploadDataFiles,
  useProcessDataFiles,
  useProjectDataState,
  projectDataStateKey,
} from "@/api/Projects/dataFiles";
import { queryClient } from "@/provider";

type Phase = "idle" | "submitting" | "processing";

/**
 * Post-project-creation step: the user uploads their survey data files
 * (.xlsx/.sav), the API stores them in S3 (proxy upload) and dispatches the
 * background pipeline, and we poll it to completion before handing off to the
 * persona builder chat. `projectId` comes from the route param so the page
 * survives a refresh.
 *
 * The page is re-enterable: it reads the project's data state on load, so a run
 * that is still going is resumed rather than restarted, a run that failed while
 * the tab was closed is shown with a retry, and a project the user has already
 * started working in sends them to the chat instead.
 */
function UploadPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  const { items, addFiles, removeItem, clear } = useDataFileSelection();
  const processMutation = useProcessDataFiles();
  const dataState = useProjectDataState(projectId);

  const [phase, setPhase] = useState<Phase>("idle");
  // The job started in THIS session. A job inherited from the server (a run the
  // user walked away from) comes from dataState instead, so the two never
  // overwrite each other.
  const [jobId, setJobId] = useState<string | null>(null);
  // Set when the user dismisses an inherited failure, so the dropzone comes back
  // without the server's stale last_failed_job pushing the error card again.
  const [dismissedFailure, setDismissedFailure] = useState(false);

  // Route param is the source of truth; guard against a direct hit with no id.
  if (!projectId) {
    return <Navigate to="/dashboard" replace />;
  }

  const invalidateState = () => {
    // Removed, not invalidated: ChatEntry routes on this answer, and an
    // invalidated query still hands out its stale value while refetching —
    // which would bounce the user back here after the pipeline just finished.
    queryClient.removeQueries({ queryKey: projectDataStateKey(projectId) });
    queryClient.invalidateQueries({ queryKey: ["ProjectList"] });
  };

  /**
   * Leave for the builder. `fromUpload` tells ChatEntry this navigation came out
   * of the upload step deliberately, so it must not route back into it — true
   * both for "Skip for now" and for a finished pipeline. Without it the handoff
   * depends on the server having already recorded the state change, and any lag
   * there lands the user back on the step they just completed.
   */
  const goToBuilder = () =>
    navigate("/chat", {
      state: { projectId, fromUpload: true },
      replace: true,
    });

  const handleUpload = async () => {
    if (items.length === 0 || phase !== "idle") return;
    setPhase("submitting");
    try {
      const uploaded = await uploadDataFiles(
        projectId,
        items.map((i) => i.file),
      );
      const res = await processMutation.mutateAsync({
        projectId,
        fileIds: uploaded.map((u) => u.file_id),
      });
      clear();
      setJobId(res.job_id);
      setPhase("processing");
    } catch {
      // uploadDataFiles / postApi already surfaced a toast; return to idle so
      // the user can adjust and retry. Re-read the state in case the failure was
      // a 409 — another tab owns a run, whose progress we should show instead.
      setPhase("idle");
      dataState.refetch();
    }
  };

  const handlePipelineComplete = () => {
    toast.success("Your data is ready");
    invalidateState();
    goToBuilder();
  };

  const handlePipelineError = () => {
    toast.error("Data processing failed. Please try uploading again.");
    setJobId(null);
    setPhase("idle");
    setDismissedFailure(true);
    invalidateState();
  };

  if (dataState.isPending) {
    return (
      <div className="flex h-[calc(100vh-90px)] flex-col items-center justify-center gap-4">
        <GradientRingLoader size="lg" />
        <TextShimmerLoader text="Loading project…" />
      </div>
    );
  }

  // A run started elsewhere (or before the tab was closed) that is still going.
  const inheritedJobId = dataState.data?.active_job?.job_id ?? null;
  const activeJobId = jobId ?? inheritedJobId;

  // The project is no longer in setup (someone chatted, built personas, or the
  // data is already processed). Covers a bookmark, a refresh, and a second tab.
  // A live run outranks the lock: watching it through is strictly better than
  // being bounced away from progress that is still moving.
  if (dataState.data && !dataState.data.upload_allowed && !activeJobId) {
    return <Navigate to="/chat" state={{ projectId }} replace />;
  }
  const inheritedFailure = dismissedFailure
    ? null
    : (dataState.data?.last_failed_job ?? null);

  const busy = phase !== "idle" || Boolean(activeJobId);
  const cameFromCreate = Boolean(
    (state as { fromCreate?: boolean } | null)?.fromCreate,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 duration-300 animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-gradient-brand w-fit text-xl font-semibold">
          Upload your data
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cameFromCreate ? "Project created. " : ""}
          Add the survey files your personas will be built from. We'll process
          them, then take you to the persona builder.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        {/* Left: upload / progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data files</CardTitle>
            <CardDescription>
              Upload one or more .xlsx or .sav files.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              <a
                href="/instructions.pdf"
                download
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download instructions
              </a>
              <a
                href="/sample_data.xlsx"
                download
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download sample Excel file
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJobId ? (
              <DataPipelineProgress
                jobId={activeJobId}
                // A run inherited from the server was already in flight when this
                // page loaded — say so, rather than implying it just started.
                resumed={!jobId}
                onComplete={handlePipelineComplete}
                onError={handlePipelineError}
              />
            ) : (
              <>
                {inheritedFailure && (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30"
                  >
                    <p className="font-medium text-rose-900 dark:text-rose-200">
                      Your last upload didn't finish
                    </p>
                    <p className="mt-0.5 text-xs text-rose-800/90 dark:text-rose-300/90">
                      {inheritedFailure.error.message}
                    </p>
                  </div>
                )}

                <DataFileDropzone
                  items={items}
                  onAddFiles={addFiles}
                  onRemove={removeItem}
                  disabled={busy}
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToBuilder()}
                    disabled={busy}
                  >
                    Skip for now
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={items.length === 0 || busy}
                  >
                    {phase === "submitting" ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        Upload &amp; Continue
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: required format example */}
        {/* <RequiredFormatCard /> */}
      </div>
    </div>
  );
}

export default UploadPage;
