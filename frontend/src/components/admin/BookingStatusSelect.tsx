"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { adminApiFetch } from "@/lib/api";
import type { BookingStatus, PaymentMethod } from "@/types/api";

// For Stripe bookings "refunded" isn't offered: it's set by refunding the
// payment on the Payments screen (the API rejects setting it by hand), so it
// only appears as the current value of an already-refunded booking. External
// bookings are refunded outside this system, so the admin records it here.
const BASE_STATUSES: BookingStatus[] = ["pending", "awaiting_payment", "confirmed", "cancelled"];

export function BookingStatusSelect({
  bookingId,
  status,
  paymentMethod,
}: {
  bookingId: number;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
}) {
  const router = useRouter();

  const onChange = async (value: string) => {
    await adminApiFetch(`/admin/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    router.refresh();
  };

  return <Select value={status} onValueChange={onChange} options={(paymentMethod === "external" || status === "refunded" ? [...BASE_STATUSES, "refunded" as const] : BASE_STATUSES).map((s) => ({
        value: s,
        label: s,
      }))} className="w-44" />;
}
