"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { adminApiFetch } from "@/lib/api";

const STATUSES = ["new", "replied", "archived"] as const;

export function ContactMessageStatusSelect({ messageId, status }: { messageId: number; status: string }) {
  const router = useRouter();

  const onChange = async (value: string) => {
    await adminApiFetch(`/admin/contact-messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    router.refresh();
  };

  return <Select value={status} onValueChange={onChange} options={STATUSES.map((s) => ({ value: s, label: s }))} className="w-36" />;
}
