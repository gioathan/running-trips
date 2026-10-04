import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth-server";
import { SITE_URL } from "@/lib/seo";
import { backendFetch, qs } from "@/lib/api";
import { AppProviders } from "@/components/layout/AppProviders";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import type { Page, SiteSettings, TripListItem } from "@/types/api";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "greek"], variable: "--font-inter" });

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("defaultTitle"), template: `%s — ${t("siteName")}` },
    description: t("defaultDescription"),
    openGraph: { siteName: t("siteName"), locale: locale === "el" ? "el_GR" : "en_US", type: "website" },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);

  const [messages, user, tripsPage, siteSettings] = await Promise.all([
    getMessages(),
    getCurrentUser(),
    backendFetch<Page<TripListItem>>(`/trips${qs({ status: "upcoming", page_size: 12, locale })}`, {
      next: { revalidate: 300 },
    }).catch(() => null),
    backendFetch<SiteSettings>("/site-settings/public", { cache: "no-store" }).catch((): SiteSettings => ({})),
  ]);

  // Ticker items: real race name + city from upcoming trips, falling back to
  // Marquee's own static defaults if the trips list is empty/unavailable.
  const marqueeItems = tripsPage?.items.length
    ? tripsPage.items.map((trip) => (trip.location_city ? `${trip.title} · ${trip.location_city}` : trip.title))
    : undefined;

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider messages={messages}>
          <AppProviders initialUser={user}>
            <Header marqueeItems={marqueeItems} />
            <main className="mx-auto max-w-[1280px] px-4 pb-24 md:px-8 md:pb-16">{children}</main>
            <Footer settings={siteSettings.footer} />
            <MobileBottomNav />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
