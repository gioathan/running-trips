"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { adminApiFetch, ApiError } from "@/lib/api";

export function RefundPaymentButton({ paymentId, amountCents }: { paymentId: number; amountCents: number }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRefund = async () => {
    const amount = `€${(amountCents / 100).toFixed(2)}`;
    if (!window.confirm(`Refund ${amount} in full through Stripe? This also marks the booking refunded and can't be undone.`)) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await adminApiFetch(`/admin/payments/${paymentId}/refund`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refund failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" onClick={onRefund} disabled={isSubmitting}>
        {isSubmitting ? "Refunding…" : "Refund"}
      </Button>
      {error && <p className="mt-1 text-body-sm text-error">{error}</p>}
    </div>
  );
}
