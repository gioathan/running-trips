import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { BookingStatusSelect } from "@/components/admin/BookingStatusSelect";
import type { BookingAdmin, Page } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<BookingAdmin>[] = [
  { header: "Ref", render: (b) => `#${b.id}` },
  {
    header: "Trip",
    render: (b) => (
      <span>
        {b.trip.title}
        {b.trip.deleted && <span className="block text-body-sm text-ink-muted">deleted trip · {b.trip.start_date}</span>}
      </span>
    ),
  },
  {
    header: "Contact",
    render: (b) => (
      <div className="text-body-sm">
        <p className="text-body-md">{b.contact_email ?? b.user_email}</p>
        {b.contact_phone && <p>{b.contact_phone}</p>}
        {b.contact_email && b.contact_email !== b.user_email && (
          <p className="text-ink-muted">account: {b.user_email}</p>
        )}
        {b.emergency_contact_name && (
          <p className="text-ink-muted">
            emergency: {b.emergency_contact_name}
            {b.emergency_contact_phone ? ` · ${b.emergency_contact_phone}` : ""}
          </p>
        )}
      </div>
    ),
  },
  {
    header: "Participants",
    render: (b) => (
      // Collapsed by default — the details are for race entries and rooming lists.
      <details>
        <summary className="cursor-pointer">{b.participant_count}</summary>
        <ul className="mt-2 space-y-2 text-body-sm">
          {b.participants.map((p) => (
            <li key={p.id}>
              <p className="text-body-md">{p.full_name}</p>
              <p className="text-ink-muted">
                {[p.date_of_birth, p.gender, p.nationality, p.shirt_size && `shirt ${p.shirt_size}`]
                  .filter(Boolean)
                  .join(" · ") || "no details (older booking)"}
              </p>
            </li>
          ))}
        </ul>
      </details>
    ),
  },
  { header: "Total", render: (b) => `€${(b.total_amount_cents / 100).toFixed(2)}` },
  { header: "Created", render: (b) => b.created_at.slice(0, 10) },
  {
    header: "Payment",
    render: (b) =>
      b.payment_method === "external" ? (
        <span>
          External link
          {b.payment_due_at && (
            <span className="block text-body-sm text-ink-muted">unpaid · held until {b.payment_due_at.slice(0, 10)}</span>
          )}
        </span>
      ) : (
        "Stripe"
      ),
  },
  {
    header: "Status",
    render: (b) => <BookingStatusSelect bookingId={b.id} status={b.status} paymentMethod={b.payment_method} />,
  },
];

export default async function AdminBookingsPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const bookings = await backendFetch<Page<BookingAdmin>>("/admin/bookings?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <h1 className="text-headline-lg">Bookings</h1>
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={bookings.items} />
      </div>
    </div>
  );
}
