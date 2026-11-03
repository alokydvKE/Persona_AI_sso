import { useState } from "react";
import { Download, FileSpreadsheet, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/loader";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmptyState from "@/components/common/EmptyState";
import {
  downloadDataFile,
  useProjectDataFiles,
} from "@/api/Projects/dataFiles";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  processed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  processing: "bg-sky-100 text-sky-800 border-sky-200",
  uploaded: "bg-secondary text-foreground",
  failed: "bg-rose-100 text-rose-800 border-rose-200",
};

function formatUploadedAt(iso: string | null): string | null {
  if (!iso) return null;
  // The API sends naive UTC timestamps; mark them UTC so they render local.
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 ring-1 ring-foreground/5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
    </div>
  );
}

/**
 * The project's uploaded survey data files, each downloadable in its original
 * form. Shown when the persona dashboard's "Data Files" tile is selected.
 */
function ProjectDataFilesList({
  projectId,
}: {
  projectId: string | undefined;
}) {
  const filesQuery = useProjectDataFiles(projectId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const files = filesQuery.data?.files ?? [];

  const download = async (fileId: string, fileName: string) => {
    if (!projectId || downloadingId) return;
    setDownloadingId(fileId);
    try {
      await downloadDataFile({ projectId, fileId, fileName });
    } catch {
      // apiRequest already toasted the failure.
    } finally {
      setDownloadingId(null);
    }
  };

  if (filesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2.5 p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <FileRowSkeleton key={`file-skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <EmptyState
        className="h-[400px] justify-center"
        icon={<FolderOpen className="h-6 w-6" />}
        title="No data files yet"
        description="Data files uploaded to this project will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5 p-1">
      {files.map((file) => {
        const uploadedAt = formatUploadedAt(file.created_at);
        const isDownloading = downloadingId === file.file_id;
        return (
          <div
            key={file.file_id}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 ring-1 ring-foreground/5 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <FileSpreadsheet className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold text-foreground"
                title={file.file_name}
              >
                {file.file_name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    statusStyles[file.status] ?? statusStyles.uploaded,
                  )}
                >
                  {file.status}
                </Badge>
                {uploadedAt && <span>Uploaded {uploadedAt}</span>}
                {typeof file.rows === "number" && file.rows > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{file.rows.toLocaleString()} rows</span>
                  </>
                )}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0"
                  disabled={downloadingId !== null}
                  onClick={() => download(file.file_id, file.file_name)}
                  aria-label={`Download ${file.file_name}`}
                >
                  {isDownloading ? (
                    <CircularLoader size="sm" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectDataFilesList;
