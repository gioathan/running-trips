"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { ACCEPTED_IMAGE_TYPES, uploadImage } from "@/lib/admin-upload";

/** File picker that uploads each chosen image to R2 and hands back its
 * public URL. Errors are shown inline; `onUploaded` runs once per file. */
export function ImageUploadButton({
  onUploaded,
  multiple = false,
  label = "Upload image",
}: {
  onUploaded: (url: string) => Promise<void> | void;
  multiple?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    try {
      for (const [i, file] of list.entries()) {
        setProgress(list.length > 1 ? `Uploading ${i + 1}/${list.length}…` : "Uploading…");
        await onUploaded(await uploadImage(file));
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button type="button" variant="secondary" size="sm" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
        {progress ?? label}
      </Button>
      {error && <p className="mt-1 text-body-sm text-error">{error}</p>}
    </div>
  );
}
