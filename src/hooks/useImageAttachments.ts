import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side guard-rails for group-chat image attachments. These mirror the
 * backend limits (app/core/config.py) so obviously-invalid files are rejected
 * before we ever request a presigned URL.
 */
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/jpg",
] as const;
/** `accept` attribute for the file input. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

export type LocalAttachment = {
  /** Stable id for list keys / removal. */
  id: string;
  file: File;
  /** Object URL for preview; owned by this hook until taken/removed. */
  previewUrl: string;
};

type AddResult = {
  /** How many files were accepted and added. */
  added: number;
  /** First validation error encountered, if any (for a toast). */
  error?: string;
};

/**
 * Owns the local list of images staged in the composer: validation, dedupe of
 * object URLs, and lifecycle cleanup (revoke on remove/unmount to avoid leaks).
 *
 * `takeAll` hands ownership of the current items to the caller WITHOUT revoking
 * their preview URLs — used when the images move into an optimistic message
 * bubble that must keep rendering them for the rest of the session.
 */
export function useImageAttachments() {
  const [items, setItems] = useState<LocalAttachment[]>([]);

  // Mirror of `items` for synchronous reads inside addFiles (avoids stale
  // closures and lets us enforce the cap without a functional-update side
  // effect, which would double-run under React StrictMode).
  const itemsRef = useRef<LocalAttachment[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Every object URL we created, so we can revoke any that are still ours.
  const urlsRef = useRef<Set<string>>(new Set());

  const validateFile = (file: File): string | undefined => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return `"${file.name || "file"}" is not a supported image (PNG, JPG, WEBP, GIF)`;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `"${file.name}" exceeds the ${MAX_IMAGE_MB} MB limit`;
    }
    return undefined;
  };

  const addFiles = useCallback((fileList: FileList | File[]): AddResult => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return { added: 0 };

    let error: string | undefined;
    const valid: LocalAttachment[] = [];
    let count = itemsRef.current.length;

    for (const file of incoming) {
      if (count >= MAX_IMAGES) {
        error = `You can attach up to ${MAX_IMAGES} images`;
        break;
      }
      const fileError = validateFile(file);
      if (fileError) {
        error = fileError;
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      urlsRef.current.add(previewUrl);
      valid.push({ id: crypto.randomUUID(), file, previewUrl });
      count += 1;
    }

    if (valid.length > 0) setItems((prev) => [...prev, ...valid]);
    return { added: valid.length, error };
  }, []);

  const revoke = (url: string) => {
    if (urlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  };

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) revoke(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => revoke(i.previewUrl));
    setItems([]);
  }, []);

  /**
   * Return the current items and empty the composer WITHOUT revoking their
   * preview URLs — ownership transfers to the caller. The URLs remain tracked
   * in `urlsRef`, so they are still revoked on unmount and never leak.
   */
  const takeAll = useCallback((): LocalAttachment[] => {
    const taken = itemsRef.current;
    setItems([]);
    return taken;
  }, []);

  /** Put a previously-taken batch back into the composer (e.g. failed upload). */
  const restore = useCallback((restored: LocalAttachment[]) => {
    if (restored.length === 0) return;
    setItems((prev) => [...prev, ...restored]);
  }, []);

  // Revoke every URL we still own on unmount.
  useEffect(
    () => () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    },
    [],
  );

  return { items, addFiles, removeItem, clear, takeAll, restore };
}
