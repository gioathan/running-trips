import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { ContactMessageStatusSelect } from "@/components/admin/ContactMessageStatusSelect";
import type { ContactMessageAdmin, Page } from "@/types/api";

export const dynamic = "force-dynamic";

const sender: AdminColumn<ContactMessageAdmin> = { header: "From", render: (m) => m.user_email };
const type: AdminColumn<ContactMessageAdmin> = { header: "Type", render: (m) => m.inquiry_type };
const received: AdminColumn<ContactMessageAdmin> = { header: "Received", render: (m) => m.created_at.slice(0, 10) };
const status: AdminColumn<ContactMessageAdmin> = {
  header: "Status",
  render: (m) => <ContactMessageStatusSelect messageId={m.id} status={m.status} />,
};

// New messages show the whole text — they're the ones being read and answered.
const newColumns: AdminColumn<ContactMessageAdmin>[] = [
  sender,
  type,
  { header: "Message", render: (m) => <p className="max-w-[480px] whitespace-pre-line">{m.message}</p> },
  received,
  status,
];

const handledColumns: AdminColumn<ContactMessageAdmin>[] = [
  sender,
  type,
  { header: "Message", render: (m) => <span className="line-clamp-2 max-w-[360px]">{m.message}</span> },
  received,
  status,
];

export default async function AdminContactMessagesPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const fetchByStatus = (value: ContactMessageAdmin["status"], pageSize: number) =>
    backendFetch<Page<ContactMessageAdmin>>(`/admin/contact-messages?status=${value}&page_size=${pageSize}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

  const [fresh, replied, archived] = await Promise.all([
    fetchByStatus("new", 100),
    fetchByStatus("replied", 50),
    fetchByStatus("archived", 50),
  ]);
  const handled = [...replied.items, ...archived.items].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <h1 className="text-headline-lg">Contact messages</h1>

      <h2 className="mt-8 text-headline-sm">
        New{fresh.total > 0 && <span className="ml-2 rounded-full bg-accent px-3 py-1 text-label-md">{fresh.total}</span>}
      </h2>
      <p className="mt-1 text-body-sm text-ink-muted">
        Waiting for an answer. Reply from your own mailbox, then set the status to &quot;replied&quot; to move it below.
      </p>
      <div className="mt-4">
        {fresh.items.length > 0 ? (
          <AdminDataTable columns={newColumns} rows={fresh.items} />
        ) : (
          <p className="rounded-md border border-dashed border-ink/30 py-8 text-center text-body-md text-ink-muted">
            No new messages.
          </p>
        )}
      </div>

      <h2 className="mt-12 text-headline-sm">Replied &amp; archived</h2>
      <div className="mt-4">
        <AdminDataTable columns={handledColumns} rows={handled} />
      </div>
    </div>
  );
}
