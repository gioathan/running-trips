"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const VISIBLE_COUNT = 5;

// ---------------------------------------------------------------------------
// Grid
//
// Phones: two columns, rows as tall as their tiles. From `sm` up: a fixed 2:1
// block of 4 columns × 2 rows that the tiles fill completely. Each tile's
// classes say how much of that it covers, and `sizes` tells the browser how
// wide the tile is drawn so it downloads a sharp-enough file (the gallery is
// full-width below `lg`, and ~800px wide beside the booking card above it).
// ---------------------------------------------------------------------------

interface Tile {
  className: string;
  sizes: string;
}

const HALF_WIDTH = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px";
const QUARTER_WIDTH = "(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px";

/** The lead photo: full-width square on phones, the left half on desktop. */
const LEAD: Tile = { className: "col-span-2 aspect-square sm:row-span-2 sm:aspect-auto", sizes: HALF_WIDTH };
/** One cell. */
const CELL: Tile = { className: "aspect-square sm:aspect-auto", sizes: QUARTER_WIDTH };
/** One cell on phones; two cells side by side on desktop. */
const WIDE_ON_DESKTOP: Tile = {
  className: "aspect-square sm:col-span-2 sm:aspect-auto",
  sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 400px",
};
/** A full-width strip on phones; one cell on desktop. */
const WIDE_ON_PHONE: Tile = {
  className: "col-span-2 aspect-[2/1] sm:col-span-1 sm:aspect-auto",
  sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 25vw, 200px",
};

/** A layout for every count that leaves no empty cells — the previous fixed
 * "one big + four small" grid left holes whenever a trip had fewer than
 * five photos. */
const LAYOUTS: Record<number, Tile[]> = {
  1: [{ className: "col-span-2 aspect-[4/3] sm:col-span-4 sm:row-span-2 sm:aspect-auto", sizes: "(max-width: 1024px) 100vw, 800px" }],
  2: [LEAD, { className: "col-span-2 aspect-[2/1] sm:row-span-2 sm:aspect-auto", sizes: HALF_WIDTH }],
  3: [LEAD, WIDE_ON_DESKTOP, WIDE_ON_DESKTOP],
  4: [LEAD, WIDE_ON_DESKTOP, CELL, WIDE_ON_PHONE],
  5: [LEAD, CELL, CELL, CELL, CELL],
};

export function TripGallery({ images, title }: { images: string[]; title: string }) {
  const t = useTranslations("tripDetail.gallery");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // The button that opened the viewer, so keyboard focus can go back to it on close.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const openViewer = (index: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setViewerIndex(index);
  };
  const visible = images.slice(0, VISIBLE_COUNT);
  const hiddenCount = images.length - visible.length;
  const layout = LAYOUTS[visible.length] ?? LAYOUTS[VISIBLE_COUNT];

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:aspect-[2/1] sm:grid-cols-4 sm:grid-rows-2">
        {visible.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => openViewer(i, e.currentTarget)}
            aria-label={t("openPhoto", { n: i + 1, total: images.length })}
            className={cn("relative overflow-hidden rounded-md border border-ink", layout[i].className)}
          >
            {/* The lead photo is the first thing seen on the page — load it right away. */}
            <Image src={url} alt="" fill className="object-cover" sizes={layout[i].sizes} priority={i === 0} />
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          // Opens at the first photo that isn't already on the page.
          onClick={(e) => openViewer(VISIBLE_COUNT, e.currentTarget)}
          className="mt-4 rounded-full border border-ink px-4 py-2 text-label-md uppercase hover:bg-surface-low"
        >
          {t("showMore", { count: hiddenCount })}
        </button>
      )}
      <Viewer images={images} title={title} index={viewerIndex} onIndexChange={setViewerIndex} onClosed={() => openerRef.current?.focus()} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Full-screen viewer
// ---------------------------------------------------------------------------

const SWIPE_DISTANCE = 50; // px a finger must travel sideways to change photo

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

const CONTROL =
  "flex h-11 items-center justify-center rounded-full border border-white/40 bg-ink/60 text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

function Viewer({
  images,
  title,
  index,
  onIndexChange,
  onClosed,
}: {
  images: string[];
  title: string;
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onClosed: () => void;
}) {
  const t = useTranslations("tripDetail.gallery");
  const open = index !== null;
  const count = images.length;
  const current = Math.min(index ?? 0, count - 1);

  // Natural size of each photo once it has loaded: tells us both that it is
  // ready to show and where its pixels sit inside the (letterboxed) frame.
  const [natural, setNatural] = useState<Record<number, { w: number; h: number }>>({});
  const [failed, setFailed] = useState<Record<number, true>>({});
  const [dragX, setDragX] = useState(0);
  // True while the photo glides back after a swipe that was too short to count.
  const [settling, setSettling] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (delta: number) => {
      if (count > 1) onIndexChange((((current + delta) % count) + count) % count);
    },
    [count, current, onIndexChange]
  );

  // The current photo plus its neighbours stay mounted (the neighbours
  // invisibly), so the browser fetches them ahead of time and moving to the
  // next or previous photo is instant rather than a blank wait.
  const mounted = count > 1 ? [...new Set([(current - 1 + count) % count, current, (current + 1) % count])] : [current];
  const ready = current in natural;
  const broken = current in failed;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };

  /** A click on the dark area — outside the photo's own pixels — closes the
   * viewer. The frame is letterboxed, so "inside the frame" isn't enough. */
  const onBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const frame = frameRef.current?.getBoundingClientRect();
    const size = natural[current];
    if (frame && size) {
      const scale = Math.min(frame.width / size.w, frame.height / size.h);
      const w = size.w * scale;
      const h = size.h * scale;
      const left = frame.left + (frame.width - w) / 2;
      const top = frame.top + (frame.height - h) / 2;
      const onPhoto = e.clientX >= left && e.clientX <= left + w && e.clientY >= top && e.clientY <= top + h;
      if (onPhoto) return;
    } else if (frame && frameRef.current?.contains(e.target as Node)) {
      return; // still loading: don't close on a click where the photo is about to appear
    }
    onIndexChange(null);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchStart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    setSettling(false);
  };
  const onTouchMove = (e: TouchEvent) => {
    const start = touchStart.current;
    if (!start || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx); // sideways drag: the photo follows the finger
  };
  const onTouchEnd = () => {
    const swiped = touchStart.current !== null && Math.abs(dragX) >= SWIPE_DISTANCE;
    if (swiped) go(dragX < 0 ? 1 : -1);
    touchStart.current = null;
    setSettling(!swiped);
    setDragX(0);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/95" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          aria-describedby={undefined}
          // Without a Dialog.Trigger the dialog doesn't know where focus came from and drops it on <body>.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          onKeyDown={onKeyDown}
          onClick={onBackdropClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <Dialog.Title className="sr-only">{t("viewerTitle", { title })}</Dialog.Title>
          {open && (
            <>
              <div
                ref={frameRef}
                // pan-y: vertical gestures stay with the browser, sideways ones are ours.
                className="relative h-full max-h-[85vh] w-full max-w-[1100px] touch-pan-y"
                style={{
                  transform: dragX ? `translateX(${dragX}px)` : undefined,
                  transition: settling ? "transform 150ms ease-out" : "none",
                }}
              >
                {mounted.map((i) => (
                  <Image
                    key={i}
                    src={images[i]}
                    alt={i === current ? t("photoAlt", { title, n: i + 1, total: count }) : ""}
                    aria-hidden={i !== current}
                    fill
                    // Never lazy: the viewer is on screen, and the neighbours are being fetched ahead on purpose.
                    loading="eager"
                    draggable={false}
                    sizes="(max-width: 1100px) 100vw, 1100px"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNatural((prev) => (i in prev ? prev : { ...prev, [i]: { w: img.naturalWidth, h: img.naturalHeight } }));
                    }}
                    onError={() => setFailed((prev) => (i in prev ? prev : { ...prev, [i]: true }))}
                    className={cn(
                      "select-none object-contain transition-opacity duration-200",
                      i === current && ready ? "opacity-100" : "opacity-0"
                    )}
                  />
                ))}
                {broken ? (
                  <p className="absolute inset-0 flex items-center justify-center text-body-md text-white/80" role="status">
                    {t("loadError")}
                  </p>
                ) : (
                  !ready && (
                    <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label={t("loading")}>
                      <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    </div>
                  )
                )}
              </div>

              <Dialog.Close className={cn(CONTROL, "absolute right-3 top-3 px-4 text-label-md uppercase")}>{t("close")}</Dialog.Close>
              {count > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label={t("previous")} className={cn(CONTROL, "absolute left-3 top-1/2 w-11 -translate-y-1/2")}>
                    <Chevron direction="left" />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label={t("next")} className={cn(CONTROL, "absolute right-3 top-1/2 w-11 -translate-y-1/2")}>
                    <Chevron direction="right" />
                  </button>
                  <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/60 px-3 py-1 text-label-sm text-white" aria-live="polite">
                    {current + 1} / {count}
                  </p>
                </>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
