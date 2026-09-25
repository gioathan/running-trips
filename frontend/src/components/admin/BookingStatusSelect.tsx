"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { adminApiFetch } from "@/lib/api";
import type { BookingStatus } from "@/types/api";

const STATUSES: BookingStatus[] = ["pending", "awaiting_payment", "confirmed", "cancelled", "refunded"];

export function BookingStatusSelect({ bookingId, status }: { bookingId: number; status: BookingStatus }) {
  const router = useRouter();

  const onChange = async (value: string) => {
    await adminApiFetch(`/admin/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    router.refresh();
  };

  return <Select value={status} onValueChange={onChange} options={STATUSES.map((s) => ({ value: s, label: s }))} className="w-44" />;
}
