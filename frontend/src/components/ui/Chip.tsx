import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "status" | "highlight" | "editorial" | "outline";

const VARIANT_CLASSES: Record<Variant, string> = {
  status: "bg-ink text-white",
  highlight: "bg-accent text-ink",
  editorial: "bg-primary text-ink",
  outline: "border border-ink text-ink bg-transparent",
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Chip({ variant = "status", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[10px] py-1 text-label-sm uppercase",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
