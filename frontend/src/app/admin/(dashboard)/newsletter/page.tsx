import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import type { Page, SubscriberAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<SubscriberAdmin>[] = [
  { header: "Email", render: (s) => s.email },
  { header: "Subscribed", render: (s) => s.subscribed_at.slice(0, 10) },
  { header: "Unsubscribed", render: (s) => s.unsubscribed_at?.slice(0, 10) ?? "—" },
  { header: "Source", render: (s) => s.source ?? "—" },
];

export default async function AdminNewsletterPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const subscribers = await backendFetch<Page<SubscriberAdmin>>("/admin/newsletter/subscribers?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <h1 className="text-headline-lg">Newsletter subscribers</h1>
      <p className="mt-2 text-body-md text-ink-muted">{subscribers.total} total.</p>
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={subscribers.items} />
      </div>
    </div>
  );
}
