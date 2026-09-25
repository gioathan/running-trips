"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { TripAdmin } from "@/types/api";

export function TripImagesManager({ tripId, images }: { tripId: number; images: TripAdmin["images"] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    if (!url) return;
    setError(null);
    try {
      await adminApiFetch(`/admin/trips/${tripId}/images`, {
        method: "POST",
        body: JSON.stringify({ url, alt_text: altText || null, sort_order: images.length }),
      });
      setUrl("");
      setAltText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add image");
    }
  };

  const onDelete = async (imageId: number) => {
    await adminApiFetch(`/admin/trips/${tripId}/images/${imageId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Card className="p-6">
      <h2 className="text-headline-sm">Images</h2>
      <p className="mt-1 text-body-sm text-ink-muted">
        Upload to R2 first (via the presign endpoint) and paste the resulting public URL here.
      </p>
      <ul className="mt-4 space-y-2">
        {images.map((image) => (
          <li key={image.id} className="flex items-center justify-between gap-3 rounded-md border border-ink/10 p-2">
            <span className="truncate text-body-sm">{image.url}</span>
            <button type="button" onClick={() => onDelete(image.id)} className="shrink-0 text-body-sm text-error underline">
              Remove
            </button>
          </li>
        ))}
        {images.length === 0 && <p className="text-body-sm text-ink-muted">No images yet.</p>}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="image-url">Image URL</Label>
          <Input id="image-url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="image-alt">Alt text</Label>
          <Input id="image-alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
        </div>
        <Button type="button" variant="secondary" onClick={onAdd}>
          Add
        </Button>
      </div>
      {error && <p className="mt-2 text-body-sm text-error">{error}</p>}
    </Card>
  );
}
