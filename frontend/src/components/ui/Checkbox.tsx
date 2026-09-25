"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { cn } from "@/lib/cn";

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ id, checked, onCheckedChange, className }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-ink data-[state=checked]:bg-ink",
        className
      )}
    >
      <RadixCheckbox.Indicator className="text-accent text-xs leading-none">✓</RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
