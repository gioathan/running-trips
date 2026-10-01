"use client";

import type { SVGProps } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";

type IconProps = SVGProps<SVGSVGElement>;

// Shared stroke-icon defaults so each icon only needs to define its path.
function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5h2.5a1 1 0 0 0 1-1v-9" />
  </Icon>
);

const TripsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.25" />
  </Icon>
);

const ServicesIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </Icon>
);

const ContactIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 6.5 8 6 8-6" />
  </Icon>
);

const AccountIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8.5" r="3.25" />
    <path d="M4.75 19.5a7.25 7.25 0 0 1 14.5 0" />
  </Icon>
);

const ITEMS = [
  { href: "/", key: "home", Icon: HomeIcon },
  { href: "/trips", key: "trips", Icon: TripsIcon },
  { href: "/services", key: "services", Icon: ServicesIcon },
  { href: "/contact", key: "contact", Icon: ContactIcon },
] as const;

export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();
  const { open } = useLoginModal();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-ink/10 bg-white md:hidden">
      {ITEMS.map(({ href, key, Icon: ItemIcon }) => (
        <Link
          key={href}
          href={href}
          aria-label={t(key)}
          className={cn("flex items-center justify-center p-3", pathname === href ? "text-ink" : "text-ink-muted")}
        >
          <ItemIcon className="h-6 w-6" />
        </Link>
      ))}
      {user ? (
        <Link
          href="/account/profile"
          aria-label={t("account")}
          className={cn("flex items-center justify-center p-3", pathname === "/account/profile" ? "text-ink" : "text-ink-muted")}
        >
          <AccountIcon className="h-6 w-6" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => open({ tab: "login" })}
          aria-label={t("account")}
          className="flex items-center justify-center p-3 text-ink-muted"
        >
          <AccountIcon className="h-6 w-6" />
        </button>
      )}
    </nav>
  );
}
