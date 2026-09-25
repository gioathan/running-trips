"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { TripAdmin } from "@/types/api";

export function TripInclusionsManager({ tripId, inclusions }: { tripId: number; inclusions: TripAdmin["inclusions"] }) {
  const router = useRouter();
  const [enLabel, setEnLabel] = useState("");
  const [elLabel, setElLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    if (!enLabel && !elLabel) return;
    setError(null);
    try {
      await adminApiFetch(`/admin/trips/${tripId}/inclusions`, {
        method: "POST",
        body: JSON.stringify({
          sort_order: inclusions.length,
          translations: [
            ...(enLabel ? [{ locale: "en", label: enLabel }] : []),
            ...(elLabel ? [{ locale: "el", label: elLabel }] : []),
          ],
        }),
      });
      setEnLabel("");
      setElLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add inclusion");
    }
  };

  const onDelete = async (inclusionId: number) => {
    await adminApiFetch(`/admin/trips/${tripId}/inclusions/${inclusionId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Card className="p-6">
      <h2 className="text-headline-sm">What&apos;s included</h2>
      <ul className="mt-4 space-y-2">
        {inclusions.map((inclusion) => (
          <li key={inclusion.id} className="flex items-center justify-between gap-3 rounded-md border border-ink/10 p-2">
            <span className="text-body-sm">
              {inclusion.translations.en ?? "—"} / {inclusion.translations.el ?? "—"}
            </span>
            <button type="button" onClick={() => onDelete(inclusion.id)} className="shrink-0 text-body-sm text-error underline">
              Remove
            </button>
          </li>
        ))}
        {inclusions.length === 0 && <p className="text-body-sm text-ink-muted">No inclusions yet.</p>}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="incl-en">Label (EN)</Label>
          <Input id="incl-en" value={enLabel} onChange={(e) => setEnLabel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="incl-el">Label (EL)</Label>
          <Input id="incl-el" value={elLabel} onChange={(e) => setElLabel(e.target.value)} />
        </div>
        <Button type="button" variant="secondary" onClick={onAdd}>
          Add
        </Button>
      </div>
      {error && <p className="mt-2 text-body-sm text-error">{error}</p>}
    </Card>
  );
}
