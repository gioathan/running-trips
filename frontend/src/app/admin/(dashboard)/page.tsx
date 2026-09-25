import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import type { Page } from "@/types/api";

export const dynamic = "force-dynamic";

async function getTotal(path: string, accessToken: string): Promise<number> {
  try {
    const page = await backendFetch<Page<unknown>>(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return page.total;
  } catch {
    return 0;
  }
}

export default async function AdminDashboardPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";

  const [tripCount, bookingCount, subscriberCount, contactCount] = await Promise.all([
    getTotal("/admin/trips?page_size=1", accessToken),
    getTotal("/admin/bookings?page_size=1&status=confirmed", accessToken),
    getTotal("/admin/newsletter/subscribers?page_size=1", accessToken),
    getTotal("/admin/contact-messages?page_size=1&status=new", accessToken),
  ]);

  const tiles = [
    { label: "Trips", value: tripCount },
    { label: "Confirmed bookings", value: bookingCount },
    { label: "Newsletter subscribers", value: subscriberCount },
    { label: "New contact messages", value: contactCount },
  ];

  return (
    <div>
      <h1 className="text-headline-lg">Dashboard</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-6">
            <p className="text-metric-display">{tile.value}</p>
            <p className="mt-1 text-label-md uppercase text-ink-muted">{tile.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
