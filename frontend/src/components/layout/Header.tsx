"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/trips", key: "trips" },
  { href: "/services", key: "services" },
  { href: "/contact", key: "contact" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const { user, logout } = useAuth();
  const { open } = useLoginModal();

  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          {/* Full logo (desktop) vs. small mark (mobile) — swap in the real
              asset once provided; placeholder wordmark for now. */}
          <span className="hidden text-headline-sm md:inline">ΑΛΛΟΥ</span>
          <span className="text-headline-sm md:hidden">Α</span>
        </Link>

        <nav className="hidden gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-body-md hover:text-primary">
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          {user ? (
            <div className="hidden items-center gap-4 md:flex">
              <Link href="/account" className="text-body-md hover:text-primary">
                {t("myTrips")}
              </Link>
              <button type="button" onClick={() => logout()} className="text-body-md text-ink-muted hover:text-ink">
                {t("logOut")}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-4 md:flex">
              <button type="button" onClick={() => open({ tab: "login" })} className="text-body-md hover:text-primary">
                {t("logIn")}
              </button>
              <ButtonLink href="/trips" size="sm">
                {t("browseTrips")}
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
