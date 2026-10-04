"use client";

import { adminApiFetch } from "@/lib/api";

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/**
 * Uploads an image straight from the browser to R2: asks the backend for a
 * presigned PUT URL (POST /admin/uploads/presign — admin-only, images
 * only), PUTs the file there, and returns the public URL to store.
 *
 * The bytes never pass through Vercel or the API server. Requires the R2
 * bucket's CORS policy to allow PUT from the site's origin (see
 * docs/DEPLOYMENT.md).
 */
export async function uploadImage(file: File): Promise<string> {
  const { upload_url, public_url } = await adminApiFetch<{ upload_url: string; public_url: string }>(
    "/admin/uploads/presign",
    { method: "POST", body: JSON.stringify({ filename: file.name, content_type: file.type }) }
  );

  const res = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload to storage failed (${res.status})`);
  return public_url;
}
