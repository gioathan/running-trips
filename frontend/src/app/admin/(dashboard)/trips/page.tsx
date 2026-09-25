import Link from "next/link";
import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { AdminButtonLink } from "@/components/admin/AdminButtonLink";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import type { Page, TripAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

const columns: AdminColumn<TripAdmin>[] = [
  { header: "Slug", render: (t) => t.slug },
  { header: "Title (EN)", render: (t) => t.translations.en?.title ?? "—" },
  { header: "Status", render: (t) => t.status },
  { header: "Dates", render: (t) => `${t.start_date} → ${t.end_date}` },
  { header: "Featured", render: (t) => (t.is_featured ? "Yes" : "") },
  {
    header: "",
    render: (t) => (
      <Link href={`/admin/trips/${t.id}/edit`} className="text-primary underline">
        Edit
      </Link>
    ),
  },
];

export default async function AdminTripsPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const trips = await backendFetch<Page<TripAdmin>>("/admin/trips?page_size=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg">Trips</h1>
        <AdminButtonLink href="/admin/trips/new">New trip</AdminButtonLink>
      </div>
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={trips.items} />
      </div>
    </div>
  );
}
