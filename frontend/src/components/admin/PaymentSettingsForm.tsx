"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { adminApiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { PaymentMethod, PaymentSettings } from "@/types/api";

const MODES: { value: PaymentMethod; title: string; body: string }[] = [
  {
    value: "stripe",
    title: "On-site payment (Stripe)",
    body: "Customers pay by card on this site. Bookings are confirmed automatically when the payment succeeds.",
  },
  {
    value: "external",
    title: "External payment link",
    body: "The booking is recorded here, then the customer is sent to your link to pay. You confirm it on the Bookings page once the payment is reported.",
  },
];

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<PaymentMethod>(initial.mode);
  const [externalUrl, setExternalUrl] = useState(initial.external_url ?? "");
  const [holdDays, setHoldDays] = useState(String(initial.external_hold_days));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const touch = () => {
    setSaved(false);
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    touch();
    if (mode === "external" && !externalUrl.trim()) {
      setError("Add a default payment link before switching to external payments.");
      return;
    }
    setBusy(true);
    try {
      await adminApiFetch<PaymentSettings>("/admin/payment-settings", {
        method: "PUT",
        body: JSON.stringify({
          mode,
          external_url: externalUrl.trim() || null,
          external_hold_days: Number(holdDays) || 3,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      // 422s carry the validator's own wording in details.errors[].msg.
      const detail =
        err instanceof ApiError
          ? ((err.details?.errors as { msg?: string }[] | undefined)?.[0]?.msg?.replace(/^Value error, /, "") ?? err.message)
          : null;
      setError(detail ?? "Could not save payment settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <h2 className="text-headline-sm">How customers pay</h2>
          <p className="mt-1 text-body-sm text-ink-muted">
            Applies to new bookings. Bookings already made keep the method they were created with.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-md border p-4",
                mode === option.value ? "border-ink bg-surface-low" : "border-ink/20"
              )}
            >
              <span className="flex items-center gap-2 text-body-md font-semibold">
                <input
                  type="radio"
                  name="payment-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => {
                    setMode(option.value);
                    touch();
                  }}
                />
                {option.title}
              </span>
              <span className="mt-2 block text-body-sm text-ink-muted">{option.body}</span>
            </label>
          ))}
        </div>

        <div className={cn("grid gap-4 md:grid-cols-[2fr_1fr]", mode === "stripe" && "opacity-60")}>
          <div>
            <Label htmlFor="external-url">Default payment link</Label>
            <Input
              id="external-url"
              type="url"
              placeholder="https://…"
              value={externalUrl}
              onChange={(e) => {
                setExternalUrl(e.target.value);
                touch();
              }}
            />
            <p className="mt-1 text-body-sm text-ink-muted">
              Used for every trip that doesn&apos;t have its own link (set on the trip&apos;s edit page). Put{" "}
              <code>{"{booking_id}"}</code> in the link to include the booking reference.
            </p>
          </div>
          <div>
            <Label htmlFor="hold-days">Hold seats for (days)</Label>
            <Input
              id="hold-days"
              type="number"
              min={1}
              max={60}
              value={holdDays}
              onChange={(e) => {
                setHoldDays(e.target.value);
                touch();
              }}
            />
            <p className="mt-1 text-body-sm text-ink-muted">Unpaid bookings are cancelled after this.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save payment settings"}
          </Button>
          {saved && <p className="text-body-sm text-ink-muted">Saved.</p>}
          {error && <p className="text-body-sm text-error">{error}</p>}
        </div>
      </form>
    </Card>
  );
}
