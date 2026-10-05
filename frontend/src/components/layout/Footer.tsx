"use client";

import { LogoFull } from "@/components/brand/Logo";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import type { Locale, SiteFooterSettings } from "@/types/api";

const LINKS = [
  { href: "/trips", key: "browseTrips" },
  { href: "/services", key: "ourServices" },
  { href: "/contact", key: "contact" },
] as const;

function NewsletterForm() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email, source: "footer", locale }),
      });
      showToast(t("subscribeSuccess"));
      setEmail("");
    } catch {
      showToast(t("subscribeError"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Phones: the field and the button each get their own full-width row.
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        // The field keeps Input's own white background and dark text.
        className="min-w-0 border-white focus:ring-white"
      />
      <Button type="submit" variant="highlight" disabled={isSubmitting} className="w-full shrink-0 sm:w-auto">
        {t("subscribe")}
      </Button>
    </form>
  );
}

export function Footer({ settings }: { settings?: SiteFooterSettings }) {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale() as Locale;
  const copy = settings?.localized?.[locale];

  return (
    // Bottom padding below md leaves room for the fixed mobile nav bar.
    <footer className="bg-footer-bg text-footer-fg">
      <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-10 md:px-8 md:pb-8 md:pt-12">
        {/* Logo | tagline + links | newsletter. Everything sits beside the
            logo, within its height, instead of stacking under it. */}
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:gap-12 lg:grid-cols-[auto_1fr_minmax(0,500px)]">
          <div className="flex items-center gap-5 md:block">
            <Link href="/" aria-label="ΑΛΛΟΥ" className="shrink-0">
              <LogoFull tone="white" className="w-[150px] md:w-[190px]" />
            </Link>
            {/* Phones: tagline sits next to the logo rather than under it. */}
            <p className="text-body-md text-white/70 md:hidden">{copy?.tagline || t("tagline")}</p>
          </div>

          <div className="flex flex-col justify-between gap-8">
            <p className="hidden max-w-[380px] text-body-md text-white/70 md:block">{copy?.tagline || t("tagline")}</p>
            <nav className="flex flex-wrap gap-x-8 gap-y-3">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-body-md text-white/80 hover:text-white">
                  {tNav(link.key)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="md:col-span-2 lg:col-span-1">
            <p className="text-label-md uppercase text-white/70">{t("newsletter")}</p>
            <p className="mt-2 text-body-md text-white/70">{copy?.newsletterBody || t("newsletterBody")}</p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
            <p className="mt-3 text-body-sm text-white/50">{copy?.newsletterHint || t("newsletterHint")}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-body-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ΑΛΛΟΥ. {t("rightsReserved")}</p>
          {settings?.social_links && settings.social_links.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {settings.social_links.map((link) => (
                <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="hover:text-white">
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
