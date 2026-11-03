import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side guard-rails for project data-file uploads. These mirror the
 * backend limits (persona-ai-BE app/core/config.py: ALLOWED_DATA_FILE_EXTENSIONS,
 * MAX_DATA_FILE_SIZE_BYTES, MAX_DATA_FILES_PER_REQUEST) so obviously-invalid files
 * are rejected before we ever hit the network. The backend re-validates and is
 * the source of truth; these are just fast feedback.
 *
 * Validation is by file EXTENSION, not MIME type: `.sav` (SPSS) has no reliable
 * browser MIME (often "" or application/octet-stream), so type-sniffing is
 * unusable here.
 */
export const ALLOWED_DATA_EXTENSIONS = ["xlsx", "sav"] as const;
export const MAX_DATA_FILES = 10;
export const MAX_DATA_FILE_BYTES = 50 * 1024 * 1024; // 200 MB
/** `accept` attribute for the file input (extension-based). */
export const DATA_FILE_ACCEPT = ".xlsx,.sav";

const MAX_DATA_FILE_MB = Math.round(MAX_DATA_FILE_BYTES / (1024 * 1024));

export type SelectedDataFile = {
  /** Stable id for list keys / removal. */
  id: string;
  file: File;
};

export type AddResult = {
  /** How many files were accepted and added. */
  added: number;
  /** First validation error encountered, if any (for a toast). */
  error?: string;
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Owns the local list of data files staged on the upload page: validation,
 * dedupe (by name+size+lastModified) and cap enforcement. Deliberately simple —
 * no object URLs/previews (these are data files, not images).
 */
export function useDataFileSelection() {
  const [items, setItems] = useState<SelectedDataFile[]>([]);

  // Mirror of `items` for synchronous reads inside addFiles (avoids stale
  // closures and double-adds under React StrictMode).
  const itemsRef = useRef<SelectedDataFile[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const validateFile = (file: File): string | undefined => {
    const ext = extensionOf(file.name);
    if (!ALLOWED_DATA_EXTENSIONS.includes(ext as (typeof ALLOWED_DATA_EXTENSIONS)[number])) {
      return `"${file.name || "file"}" is not accepted. Upload .xlsx or .sav files only.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty.`;
    }
    if (file.size > MAX_DATA_FILE_BYTES) {
      return `"${file.name}" exceeds the ${MAX_DATA_FILE_MB} MB limit.`;
    }
    return undefined;
  };

  const addFiles = useCallback((fileList: FileList | File[]): AddResult => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return { added: 0 };

    const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
    const seen = new Set(itemsRef.current.map((i) => key(i.file)));

    let error: string | undefined;
    const valid: SelectedDataFile[] = [];
    let count = itemsRef.current.length;

    for (const file of incoming) {
      if (count >= MAX_DATA_FILES) {
        error = `You can upload up to ${MAX_DATA_FILES} files at once.`;
        break;
      }
      const fileError = validateFile(file);
      if (fileError) {
        error = fileError;
        continue;
      }
      const k = key(file);
      if (seen.has(k)) continue; // silently skip exact duplicates
      seen.add(k);
      valid.push({ id: crypto.randomUUID(), file });
      count += 1;
    }

    if (valid.length > 0) setItems((prev) => [...prev, ...valid]);
    return { added: valid.length, error };
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, addFiles, removeItem, clear };
}
