"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { TripDeletionPreview, TripDeletionResult } from "@/types/api";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the admin is asked to confirm — built from the server's preview so
 * the numbers are the real ones at the moment of clicking. */
function confirmationText(title: string, p: TripDeletionPreview): string {
  const lines = [`Delete "${title}"?`, "", "It will be removed from the site. This can't be undone."];
  if (p.photos > 0) lines.push(`• ${plural(p.photos, "photo", "photos")} will be deleted from storage.`);
  if (p.bookings_to_cancel > 0) {
    lines.push(`• ${plural(p.bookings_to_cancel, "unpaid booking", "unpaid bookings")} will be cancelled.`);
  }
  if (p.bookings_kept > 0) {
    lines.push(`• ${plural(p.bookings_kept, "booking record", "booking records")} will be kept, marked as a deleted trip.`);
  }
  if (p.bookings_paid > 0) {
    lines.push(
      "",
      `WARNING: ${plural(p.bookings_paid, "customer has", "customers have")} a confirmed booking on this trip. ` +
        "Deleting it does not refund or notify them — do that yourself."
    );
  }
  return lines.join("\n");
}

export function DeleteTripButton({
  tripId,
  title,
  variant = "link",
}: {
  tripId: number;
  title: string;
  /** "link" for table rows, "button" for the edit page. */
  variant?: "link" | "button";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      const preview = await adminApiFetch<TripDeletionPreview>(`/admin/trips/${tripId}/deletion-preview`);
      if (!window.confirm(confirmationText(title, preview))) return;
      await adminApiFetch<TripDeletionResult>(`/admin/trips/${tripId}`, { method: "DELETE" });
      router.push("/admin/trips");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the trip");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className={
          variant === "button"
            ? "inline-flex h-11 items-center rounded-full border border-error px-6 text-label-lg uppercase text-error hover:bg-error-container disabled:opacity-50"
            : "text-error underline disabled:opacity-50"
        }
      >
        {busy ? "Deleting…" : variant === "button" ? "Delete trip" : "Delete"}
      </button>
      {error && <span className="ml-3 text-body-sm text-error">{error}</span>}
    </span>
  );
}
