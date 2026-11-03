import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

type FileUploaderProps = {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onSubmit:(p:string)=>void
};

export function FileUploader({ files, setFiles, onSubmit }: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [disabled, setDisabled] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);

    setFiles((prev) => [...prev, ...selected]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length)
      setFiles((pre) => [...pre, ...Array.from(e.dataTransfer.files)]);
  };

  const ButtonTEXT = `Continue with ${files.length || 0} File${files.length !== 1 ? "s" : ""}`;

  return (
    <div className="w-full rounded-2xl border bg-card p-5 shadow-xs">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Upload your source files</h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents, spreadsheets, PDFs, presentations, or images that
          should be used to generate personas.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <Upload className="mb-2 h-10 w-10 text-muted-foreground" />

        <p className="text-base font-medium">Drag & drop files here</p>

        <p className="text-sm text-muted-foreground">
          or click to browse your computer
        </p>

        <div className="mt-4 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          Supports PDF, DOCX, XLSX, CSV, PPTX, PNG, JPG
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-medium">
              Selected Files ({files.length})
            </span>

            <span className="text-xs text-muted-foreground">
              Ready for analysis
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  📄
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>

                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            After uploading, send a message describing the personas you'd like
            to create and I'll analyze these files to help build them.
          </div>
        </>
      )}
      <Button
        disabled={files.length === 0 || disabled}
        onClick={()=>{
            onSubmit(ButtonTEXT)
            setDisabled(true)
        }}
        size="lg"
        className="w-full mt-5"
      >
        {ButtonTEXT}
      </Button>
    </div>
  );
}
