"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";

const LINK_COLUMNS = [
  { headingKey: "trips", hrefs: [{ href: "/trips", key: "browseTrips" }] },
  { headingKey: "services", hrefs: [{ href: "/services", key: "ourServices" }] },
  { headingKey: "collective", hrefs: [{ href: "/contact", key: "contact" }] },
] as const;

function NewsletterForm() {
  const t = useTranslations("footer");
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch("/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email, source: "footer" }) });
      showToast(t("subscribeSuccess"));
      setEmail("");
    } catch {
      showToast(t("subscribeError"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className="border-white/20 bg-transparent text-white placeholder:text-white/50 focus:ring-white"
      />
      <Button type="submit" variant="highlight" disabled={isSubmitting}>
        {t("subscribe")}
      </Button>
    </form>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="bg-footer-bg text-footer-fg">
      <div className="mx-auto max-w-[1280px] px-4 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <span className="text-headline-sm">ΑΛΛΟΥ</span>
            <p className="mt-4 max-w-[380px] text-body-md text-white/70">{t("tagline")}</p>
            <p className="mt-6 text-body-sm text-white/50">{t("newsletterHint")}</p>
          </div>
          <div>
            <p className="text-label-md uppercase text-white/70">{t("newsletter")}</p>
            <p className="mt-2 text-body-md text-white/70">{t("newsletterBody")}</p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {LINK_COLUMNS.map((col) => (
            <div key={col.headingKey}>
              <p className="text-label-md uppercase text-white/50">{tNav(col.headingKey)}</p>
              <ul className="mt-4 space-y-2">
                {col.hrefs.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body-md text-white/80 hover:text-white">
                      {tNav(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-body-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ΑΛΛΟΥ. {t("rightsReserved")}</p>
          <div className="flex gap-6">
            <Link href="/contact">{tNav("contact")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
