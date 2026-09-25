import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { BookingStatusSelect } from "@/components/admin/BookingStatusSelect";
import type { BookingAdmin, Page } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<BookingAdmin>[] = [
  { header: "Trip", render: (b) => b.trip.title },
  { header: "Customer", render: (b) => b.user_email },
  { header: "Participants", render: (b) => b.participant_count },
  { header: "Total", render: (b) => `€${(b.total_amount_cents / 100).toFixed(2)}` },
  { header: "Created", render: (b) => b.created_at.slice(0, 10) },
  { header: "Status", render: (b) => <BookingStatusSelect bookingId={b.id} status={b.status} /> },
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
