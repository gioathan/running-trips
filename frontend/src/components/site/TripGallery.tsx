"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { cn } from "@/lib/cn";

const VISIBLE_COUNT = 5;

export function TripGallery({ images }: { images: string[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const visible = images.slice(0, VISIBLE_COUNT);
  const hiddenCount = images.length - visible.length;

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visible.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square overflow-hidden rounded-md border border-ink first:col-span-2 first:row-span-2 first:aspect-square"
          >
            <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="mt-4 rounded-full border border-ink px-4 py-2 text-label-md uppercase hover:bg-surface-low"
        >
          Show {hiddenCount} more
        </button>
      )}
      <Lightbox images={images} index={lightboxIndex} onIndexChange={setLightboxIndex} />
    </>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: string[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const open = index !== null;
  const current = index ?? 0;

  const go = (delta: number) => onIndexChange((current + delta + images.length) % images.length);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/80" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Trip photo gallery</Dialog.Title>
          {open && (
            <>
              <div className="relative h-full max-h-[85vh] w-full max-w-[1100px]">
                <Image src={images[current]} alt="" fill className="object-contain" sizes="100vw" />
              </div>
              <Dialog.Close
                className="absolute right-4 top-4 rounded-full border border-white/40 px-3 py-1 text-label-md uppercase text-white hover:bg-white/10"
                aria-label="Close"
              >
                Close
              </Dialog.Close>
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 px-3 py-2 text-white hover:bg-white/10"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 px-3 py-2 text-white hover:bg-white/10"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <p className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 text-label-sm text-white/70")}>
                    {current + 1} / {images.length}
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
