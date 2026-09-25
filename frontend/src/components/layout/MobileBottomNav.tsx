"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";

const ITEMS = [
  { href: "/", key: "home" },
  { href: "/trips", key: "trips" },
  { href: "/services", key: "services" },
  { href: "/contact", key: "contact" },
] as const;

export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();
  const { open } = useLoginModal();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-ink/10 bg-white md:hidden">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center gap-1 text-label-sm uppercase",
            pathname === item.href ? "text-ink" : "text-ink-muted"
          )}
        >
          <span className="h-5 w-5 rounded-full bg-current opacity-20" aria-hidden />
          {t(item.key)}
        </Link>
      ))}
      {user ? (
        <Link
          href="/account"
          className={cn(
            "flex flex-col items-center gap-1 text-label-sm uppercase",
            pathname === "/account" ? "text-ink" : "text-ink-muted"
          )}
        >
          <span className="h-5 w-5 rounded-full bg-current opacity-20" aria-hidden />
          {t("account")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => open({ tab: "login" })}
          className="flex flex-col items-center gap-1 text-label-sm uppercase text-ink-muted"
        >
          <span className="h-5 w-5 rounded-full bg-current opacity-20" aria-hidden />
          {t("account")}
        </button>
      )}
    </nav>
  );
}
