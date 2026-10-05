"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    // Larger text and a finger-sized tap area on phones; compact from md up.
    <div className="flex items-center text-label-lg uppercase md:gap-2 md:text-label-md">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn("px-1.5 py-2 md:p-0", loc === locale ? "text-ink" : "text-ink-muted hover:text-ink")}
          aria-current={loc === locale}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
