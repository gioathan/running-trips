"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { Locale, SiteFooterCopy, SiteFooterSettings } from "@/types/api";

const DEFAULT_COPY: Record<Locale, SiteFooterCopy> = {
  en: {
    tagline: "Small-group travel built around a race or a route, not a hotel package.",
    newsletterHint: "No spam. Unsubscribe anytime.",
    newsletterBody: "Race drops and route scouts, straight to your inbox.",
  },
  el: {
    tagline: "Ταξίδια σε μικρές ομάδες γύρω από έναν αγώνα ή μια διαδρομή, όχι ένα πακέτο ξενοδοχείου.",
    newsletterHint: "Χωρίς spam. Διαγραφή όποτε θέλετε.",
    newsletterBody: "Νέοι αγώνες και διαδρομές, απευθείας στα εισερχόμενά σας.",
  },
};

type SocialLink = { label: string; url: string };

function copyFor(initialFooter: SiteFooterSettings | undefined, locale: Locale): SiteFooterCopy {
  return {
    tagline: initialFooter?.localized?.[locale]?.tagline ?? DEFAULT_COPY[locale].tagline,
    newsletterHint: initialFooter?.localized?.[locale]?.newsletterHint ?? DEFAULT_COPY[locale].newsletterHint,
    newsletterBody: initialFooter?.localized?.[locale]?.newsletterBody ?? DEFAULT_COPY[locale].newsletterBody,
  };
}

export function SiteSettingsForm({ initialFooter }: { initialFooter?: SiteFooterSettings }) {
  const router = useRouter();
  const [en, setEn] = useState(() => copyFor(initialFooter, "en"));
  const [el, setEl] = useState(() => copyFor(initialFooter, "el"));
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initialFooter?.social_links ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const updateCopy = (locale: Locale, key: keyof SiteFooterCopy, value: string) => {
    const setCopy = locale === "en" ? setEn : setEl;
    setCopy((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const updateLink = (index: number, key: keyof SocialLink, value: string) => {
    setSocialLinks((current) => current.map((link, linkIndex) => linkIndex === index ? { ...link, [key]: value } : link));
    setSaved(false);
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const footer: SiteFooterSettings = {
      localized: { en, el },
      social_links: socialLinks.map((link) => ({ label: link.label.trim(), url: link.url.trim() })),
    };

    try {
      await adminApiFetch("/admin/site-settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: { footer } }),
      });
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Could not save site settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-headline-lg">Site settings</h1>
        <p className="mt-2 text-body-md text-ink-muted">Footer copy and social links</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <Card className="p-6">
          <h2 className="text-headline-sm">English footer</h2>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="footer-en-tagline">Tagline</Label>
              <Textarea id="footer-en-tagline" rows={2} required value={en.tagline} onChange={(event) => updateCopy("en", "tagline", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="footer-en-newsletter-body">Newsletter description</Label>
              <Textarea id="footer-en-newsletter-body" rows={2} required value={en.newsletterBody} onChange={(event) => updateCopy("en", "newsletterBody", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="footer-en-newsletter-hint">Newsletter note</Label>
              <Input id="footer-en-newsletter-hint" required value={en.newsletterHint} onChange={(event) => updateCopy("en", "newsletterHint", event.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-headline-sm">Greek footer</h2>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="footer-el-tagline">Tagline</Label>
              <Textarea id="footer-el-tagline" rows={2} required value={el.tagline} onChange={(event) => updateCopy("el", "tagline", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="footer-el-newsletter-body">Newsletter description</Label>
              <Textarea id="footer-el-newsletter-body" rows={2} required value={el.newsletterBody} onChange={(event) => updateCopy("el", "newsletterBody", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="footer-el-newsletter-hint">Newsletter note</Label>
              <Input id="footer-el-newsletter-hint" required value={el.newsletterHint} onChange={(event) => updateCopy("el", "newsletterHint", event.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-headline-sm">Social links</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSocialLinks((current) => [...current, { label: "", url: "" }])} disabled={busy}>
              Add link
            </Button>
          </div>
          <div className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {socialLinks.map((link, index) => (
              <div key={index} className="grid gap-3 py-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <div>
                  <Label htmlFor={`social-${index}-label`}>Label</Label>
                  <Input id={`social-${index}-label`} required value={link.label} onChange={(event) => updateLink(index, "label", event.target.value)} placeholder="Instagram" />
                </div>
                <div>
                  <Label htmlFor={`social-${index}-url`}>URL</Label>
                  <Input id={`social-${index}-url`} type="url" required value={link.url} onChange={(event) => updateLink(index, "url", event.target.value)} placeholder="https://instagram.com/..." />
                </div>
                <button type="button" onClick={() => { setSocialLinks((current) => current.filter((_, linkIndex) => linkIndex !== index)); setSaved(false); }} className="pb-2 text-body-sm text-error underline" disabled={busy}>
                  Remove
                </button>
              </div>
            ))}
            {socialLinks.length === 0 && <p className="py-4 text-body-sm text-ink-muted">No social links configured.</p>}
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
          {saved && <span role="status" className="text-body-sm text-success">Saved</span>}
        </div>
        {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      </form>
    </div>
  );
}