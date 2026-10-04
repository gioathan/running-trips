"use client";

import { useRouter } from "next/navigation";
import { adminApiFetch } from "@/lib/api";

export function DeleteTripCommentButton({ commentId }: { commentId: number }) {
  const router = useRouter();

  const onDelete = async () => {
    if (!window.confirm("Delete this comment? It's removed from the trip page and can't be restored.")) return;
    await adminApiFetch(`/admin/trip-comments/${commentId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <button type="button" onClick={onDelete} className="text-body-sm text-error underline">
      Delete
    </button>
  );
}
