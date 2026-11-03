import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, X, FileIcon, ImageIcon, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trigger?: React.ReactNode;
  onUpload?: (files: File[]) => void | Promise<void>;
  accept?: string;
  maxSizeMb?: number;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(file: File) {
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.includes("pdf") || file.type.includes("text")) return FileText;
  return FileIcon;
}

export function MultiFileUploadDialog({ open, setOpen, trigger, onUpload, accept, maxSizeMb = 25 }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) => f.size <= maxSizeMb * 1024 * 1024);
    setFiles((prev) => {
      const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
      const seen = new Set(prev.map(key));
      return [...prev, ...arr.filter((f) => !seen.has(key(f)))];
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const remove = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      await onUpload?.(files);
      setFiles([]);
      setOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>}
      <DialogContent className="sm:max-w-lg" showCloseButton={false} onInteractOutside={(e)=>{e.preventDefault()}}>
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Drag and drop or browse. Max {maxSizeMb}MB per file.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors",
            dragging && "border-primary bg-accent",
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">Select multiple files</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            onChange={onChange}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <ScrollArea className="max-h-56 rounded-md border border-border">
            <ul className="divide-y divide-border">
              {files.map((file, i) => {
                const Icon = iconFor(file);
                return (
                  <li key={`${file.name}-${i}`} className="flex items-center gap-3 p-3">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => remove(i)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"} · {formatSize(totalSize)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFiles([])} disabled={!files.length || uploading}>
              Clear
            </Button>
            <Button onClick={handleUpload} disabled={!files.length || uploading}>
              {uploading ? "Uploading..." : `Upload ${files.length || ""}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
