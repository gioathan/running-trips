"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";
import { formatDateRange } from "@/lib/format-date";
import type { PendingTripComment } from "@/types/api";

const VISIBLE_COUNT = 3;

export function PendingCommentsSection({ initial }: { initial: PendingTripComment[] }) {
  const t = useTranslations("account");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const { showToast } = useToast();
  const [items, setItems] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const hiddenCount = items.length - visible.length;

  const onDraftChange = (tripId: number, value: string) => {
    setDrafts((prev) => ({ ...prev, [tripId]: value }));
    // Once the user starts writing one of the visible comments, reveal the
    // rest of the backlog too instead of making them hunt for "show more".
    if (value.trim().length > 0 && hiddenCount > 0) setExpanded(true);
  };

  const onSubmit = async (tripId: number) => {
    const body = (drafts[tripId] ?? "").trim();
    if (!body) return;
    setSubmittingId(tripId);
    try {
      await apiFetch("/trip-comments", { method: "POST", body: JSON.stringify({ trip_id: tripId, body }) });
      setItems((prev) => prev.filter((item) => item.trip_id !== tripId));
      showToast(t("commentSuccess"));
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section className="mt-12">
      <h2 className="text-headline-md">{t("commentsHeadline")}</h2>
      <p className="mt-1 text-body-md text-ink-muted">{t("commentsSubtitle")}</p>

      <div className="mt-6 space-y-4">
        {visible.map((item) => (
          <Card key={item.trip_id} className="flex flex-col gap-4 p-4 sm:flex-row">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-low">
              {item.cover_image_url && (
                <Image src={item.cover_image_url} alt={item.title} fill className="object-cover" sizes="64px" />
              )}
            </div>
            <div className="flex-1">
              <Link href={`/trips/${item.slug}`} className="text-headline-sm hover:text-primary">
                {item.title}
              </Link>
              <p className="text-body-sm text-ink-muted">{formatDateRange(item.start_date, item.end_date, locale)}</p>
              <Textarea
                value={drafts[item.trip_id] ?? ""}
                onChange={(e) => onDraftChange(item.trip_id, e.target.value)}
                placeholder={t("commentPlaceholder")}
                className="mt-3 min-h-[72px]"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!(drafts[item.trip_id] ?? "").trim() || submittingId === item.trip_id}
                  onClick={() => onSubmit(item.trip_id)}
                >
                  {t("commentSubmit")}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 rounded-full border border-ink px-4 py-2 text-label-md uppercase hover:bg-surface-low"
        >
          {t("commentsShowMore", { count: hiddenCount })}
        </button>
      )}
    </section>
  );
}
