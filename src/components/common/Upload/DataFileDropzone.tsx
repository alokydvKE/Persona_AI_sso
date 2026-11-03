import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, X, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DATA_FILE_ACCEPT,
  MAX_DATA_FILES,
  type AddResult,
  type SelectedDataFile,
} from "@/hooks/useDataFileSelection";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  items: SelectedDataFile[];
  onAddFiles: (files: FileList | File[]) => AddResult;
  onRemove: (id: string) => void;
  /** Disabled while an upload / pipeline is in progress. */
  disabled?: boolean;
};

/**
 * Drag-and-drop + click-to-browse picker for the project's .xlsx/.sav data
 * files. Validation lives in {@link useDataFileSelection} (owned by the parent);
 * this surfaces the first rejection as a toast and renders the staged list.
 */
function DataFileDropzone({ items, onAddFiles, onRemove, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (files: FileList | File[]) => {
    const { error } = onAddFiles(files);
    if (error) toast.error(error);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) handleAdd(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleAdd(e.target.files);
    e.target.value = "";
  };

  const totalSize = items.reduce((s, i) => s + i.file.size, 0);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary/60",
          dragging && !disabled && "border-primary bg-accent",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          .xlsx or .sav · up to {MAX_DATA_FILES} files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DATA_FILE_ACCEPT}
          onChange={onChange}
          disabled={disabled}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        // The height cap has to sit on the VIEWPORT, not the root: the root has
        // no definite height, so the viewport's own `size-full` (height: 100%)
        // resolves to auto and it grows straight past a max-height set here —
        // which is why the list used to spill over the buttons below it at 4-5
        // files. `overflow-hidden` on the root keeps the rounded corners
        // clipping the rows.
        <ScrollArea
          className={cn(
            "overflow-hidden rounded-md border border-border",
            "[&>[data-slot=scroll-area-viewport]]:max-h-56",
          )}
        >
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
                {/* min-w-0 on the flex child, or a long filename refuses to
                    shrink and pushes the size and remove button out of the row. */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(item.file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemove(item.id)}
                  disabled={disabled}
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} file{items.length === 1 ? "" : "s"} ·{" "}
          {formatSize(totalSize)}
        </p>
      )}
    </div>
  );
}

export default DataFileDropzone;
