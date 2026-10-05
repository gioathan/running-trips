"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DIAL_CODES, joinPhone, splitPhone } from "@/lib/phone";

const fieldClasses =
  "rounded-md border border-ink bg-white py-[10px] text-body-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink";

/** Country-code picker + number. `value`/`onChange` speak E.164
 * ("+306912345678"), so the form and the API never see the two parts. */
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
}) {
  // Local parts: `value` can't represent "code chosen, number still empty".
  const [parts, setParts] = useState(() => splitPhone(value));

  const update = (next: { dialCode: string; national: string }) => {
    setParts(next);
    onChange(joinPhone(next.dialCode, next.national));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <select
        aria-label="Country code"
        value={parts.dialCode}
        onChange={(e) => update({ ...parts, dialCode: e.target.value })}
        onBlur={onBlur}
        className={cn(fieldClasses, "w-[7.5rem] shrink-0 px-2")}
      >
        {DIAL_CODES.map((d) => (
          <option key={d.code} value={d.code}>
            {d.country} {d.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={parts.national}
        onChange={(e) => update({ ...parts, national: e.target.value })}
        onBlur={onBlur}
        className={cn(fieldClasses, "w-full min-w-0 px-[17px]")}
      />
    </div>
  );
}
