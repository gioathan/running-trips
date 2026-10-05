"use client";

import { LogoMark } from "@/components/brand/Logo";
import type { SVGProps } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogoutButton } from "./LogoutButton";
import { Marquee } from "./Marquee";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { useScrolled } from "@/lib/use-scrolled";

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/trips", key: "trips" },
  { href: "/services", key: "services" },
  { href: "/contact", key: "contact" },
] as const;

function LogInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M11 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
      <path d="M3.5 12h11.25M11 8.25 14.75 12 11 15.75" />
    </svg>
  );
}

function LogOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M13 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
      <path d="M20.5 12H9.25M13 8.25 9.25 12l3.75 3.75" />
    </svg>
  );
}

export function Header({ marqueeItems }: { marqueeItems?: string[] }) {
  const t = useTranslations("nav");
  const { user } = useAuth();
  const { open } = useLoginModal();
  const scrolled = useScrolled();

  return (
    // overflow-anchor:none stops Chrome's scroll-anchoring from "correcting" scrollY when this
    // header's height animates, which was re-triggering useScrolled and causing content to
    // jump/cut and reappear while scrolling.
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-canvas/95 backdrop-blur [overflow-anchor:none]">
      <div
        className={cn(
          "mx-auto flex max-w-[1280px] items-center justify-between px-4 transition-[height] duration-300 md:px-8",
          scrolled ? "h-14" : "h-20"
        )}
      >
        {/* -m-2 p-2 gives the mark a comfortable tap area without moving it. */}
        <Link href="/" className="-m-2 flex items-center p-2" aria-label="ΑΛΛΟΥ">
          <LogoMark className={cn("transition-[height] duration-300", scrolled ? "h-8" : "h-10")} />
        </Link>

        <nav className="hidden gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-body-md hover:text-primary">
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <LocaleSwitcher />
          {user ? (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <Link href="/account" className="text-body-md hover:text-primary">
                  {t("myTrips")}
                </Link>
                <LogoutButton className="text-body-md text-ink-muted hover:text-ink" />
              </div>
              {/* -m-2 p-2: bigger tap area without shifting the layout */}
              <LogoutButton className="-m-2 p-2 text-ink-muted hover:text-ink md:hidden">
                <LogOutIcon className="h-7 w-7" />
              </LogoutButton>
            </>
          ) : (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <button type="button" onClick={() => open({ tab: "login" })} className="text-body-md hover:text-primary">
                  {t("logIn")}
                </button>
                <ButtonLink href="/trips" size="sm">
                  {t("browseTrips")}
                </ButtonLink>
              </div>
              <button
                type="button"
                onClick={() => open({ tab: "login" })}
                aria-label={t("logIn")}
                className="-m-2 p-2 text-ink-muted hover:text-ink md:hidden"
              >
                <LogInIcon className="h-7 w-7" />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 [overflow-anchor:none]",
          scrolled ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
      >
        {/* min-h-0 lets the grid row actually collapse to 0 — grid items default to
            min-height:auto, which otherwise clamps the 0fr row at the marquee's content height. */}
        <div className="min-h-0 overflow-hidden">
          <Marquee items={marqueeItems} />
        </div>
      </div>
    </header>
  );
}
