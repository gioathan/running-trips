"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { adminApiFetch } from "@/lib/api";
import type { BookingStatus } from "@/types/api";

// "refunded" isn't offered: it's set by refunding the payment on the Payments
// screen (the API rejects setting it by hand), so it only appears as the
// current value of an already-refunded booking.
const SETTABLE_STATUSES: BookingStatus[] = ["pending", "awaiting_payment", "confirmed", "cancelled"];

export function BookingStatusSelect({ bookingId, status }: { bookingId: number; status: BookingStatus }) {
  const router = useRouter();

  const onChange = async (value: string) => {
    await adminApiFetch(`/admin/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    router.refresh();
  };

  return <Select value={status} onValueChange={onChange} options={(SETTABLE_STATUSES.includes(status) ? SETTABLE_STATUSES : [...SETTABLE_STATUSES, status]).map((s) => ({
        value: s,
        label: s,
      }))} className="w-44" />;
}
