"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  title: string;
  hideTitle?: boolean;
  /** "sheet" slides up from the bottom edge, full-width — for mobile panels. */
  variant?: "center" | "sheet";
}

// Kept as two complete sets rather than overrides: `cn` is plain clsx (no
// tailwind-merge), so conflicting position classes wouldn't reliably win.
const VARIANT_CLASSES = {
  center:
    "left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-md border p-10",
  sheet: "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t p-6 pb-8",
};

export function Modal({ open, onOpenChange, children, className, title, hideTitle, variant = "center" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-50 overflow-y-auto border-ink bg-white shadow-hard",
            VARIANT_CLASSES[variant],
            className
          )}
        >
          <Dialog.Title className={hideTitle ? "sr-only" : "text-headline-sm mb-4"}>{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
