import Link from "next/link";
import { cookies } from "next/headers";
import { backendFetch, qs } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { cn } from "@/lib/cn";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";
import { RefundPaymentButton } from "@/components/admin/RefundPaymentButton";
import type { Page, PaymentAdmin, PaymentSettings, PaymentStatus } from "@/types/api";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; status?: PaymentStatus }[] = [
  { label: "All" },
  { label: "Succeeded", status: "succeeded" },
  { label: "Awaiting payment", status: "requires_payment" },
  { label: "Failed", status: "failed" },
  { label: "Refunded", status: "refunded" },
];

const columns: AdminColumn<PaymentAdmin>[] = [
  { header: "Created", render: (p) => p.created_at.slice(0, 16).replace("T", " ") },
  { header: "Trip", render: (p) => p.trip_title },
  { header: "Customer", render: (p) => p.user_email },
  { header: "Amount", render: (p) => `€${(p.amount_cents / 100).toFixed(2)}` },
  { header: "Payment", render: (p) => p.status },
  {
    header: "Booking",
    render: (p) => (
      // A succeeded payment on a non-confirmed booking is the case the
      // webhook flags for manual review (paid after the booking was cancelled).
      <span className={cn(p.status === "succeeded" && p.booking_status !== "confirmed" && "font-semibold text-error")}>
        #{p.booking_id} · {p.booking_status}
      </span>
    ),
  },
  { header: "Stripe ref", render: (p) => <code className="text-body-sm">{p.provider_ref}</code> },
  {
    header: "",
    render: (p) => (p.status === "succeeded" ? <RefundPaymentButton paymentId={p.id} amountCents={p.amount_cents} /> : null),
  },
];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: { status?: string } }) {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const activeStatus = FILTERS.find((f) => f.status === searchParams.status)?.status;
  const auth = { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" as const };
  const [payments, settings] = await Promise.all([
    backendFetch<Page<PaymentAdmin>>(`/admin/payments${qs({ page_size: 50, status: activeStatus })}`, auth),
    backendFetch<PaymentSettings>("/admin/payment-settings", auth),
  ]);

  return (
    <div>
      <h1 className="text-headline-lg">Payments</h1>
      <div className="mt-8">
        <PaymentSettingsForm initial={settings} />
      </div>

      <h2 className="mt-12 text-headline-sm">Stripe payments</h2>
      <p className="mt-1 text-body-sm text-ink-muted">
        Card payments taken on this site. Bookings paid through the external link don&apos;t appear here — confirm
        those on the Bookings page.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.status ? `/admin/payments?status=${f.status}` : "/admin/payments"}
            replace // a filter, not a new page — keep it out of the Back history
            className={cn(
              "rounded-full border px-4 py-1 text-label-md uppercase",
              f.status === activeStatus ? "border-ink bg-ink text-white" : "border-ink/30 text-ink-muted"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <AdminDataTable columns={columns} rows={payments.items} />
      </div>
    </div>
  );
}
