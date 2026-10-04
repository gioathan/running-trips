import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { DeleteTripCommentButton } from "@/components/admin/DeleteTripCommentButton";
import type { Page, TripCommentAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<TripCommentAdmin>[] = [
  { header: "Posted", render: (c) => c.created_at.slice(0, 10) },
  { header: "Trip", render: (c) => c.trip_title },
  { header: "Author", render: (c) => c.user_email },
  { header: "Comment", render: (c) => <p className="max-w-xl whitespace-pre-line">{c.body}</p> },
  { header: "", render: (c) => <DeleteTripCommentButton commentId={c.id} /> },
];

export default async function AdminTripCommentsPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const comments = await backendFetch<Page<TripCommentAdmin>>("/admin/trip-comments?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <h1 className="text-headline-lg">Trip Comments</h1>
      <p className="mt-2 text-body-md text-ink-muted">
        Posted by runners after a trip they had a confirmed booking on, and shown publicly on that trip&apos;s page
        (first name only). Delete anything that shouldn&apos;t be there.
      </p>
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={comments.items} />
      </div>
    </div>
  );
}
