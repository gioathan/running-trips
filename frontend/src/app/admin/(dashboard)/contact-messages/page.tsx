import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { ContactMessageStatusSelect } from "@/components/admin/ContactMessageStatusSelect";
import type { ContactMessageAdmin, Page } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<ContactMessageAdmin>[] = [
  { header: "From", render: (m) => m.user_email },
  { header: "Type", render: (m) => m.inquiry_type },
  { header: "Message", render: (m) => <span className="line-clamp-2 max-w-[360px]">{m.message}</span> },
  { header: "Received", render: (m) => m.created_at.slice(0, 10) },
  { header: "Status", render: (m) => <ContactMessageStatusSelect messageId={m.id} status={m.status} /> },
];

export default async function AdminContactMessagesPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const messages = await backendFetch<Page<ContactMessageAdmin>>("/admin/contact-messages?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <h1 className="text-headline-lg">Contact messages</h1>
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={messages.items} />
      </div>
    </div>
  );
}
