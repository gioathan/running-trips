"use client";

import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 md:bottom-6">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            "rounded-full border border-ink px-6 py-3 text-body-md shadow-hard",
            toast.variant === "success" ? "bg-accent text-ink" : "bg-error text-white"
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
