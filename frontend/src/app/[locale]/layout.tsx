import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth-server";
import { AppProviders } from "@/components/layout/AppProviders";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "greek"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ΑΛΛΟΥ — Travel beyond the finish line",
};

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

  const [messages, user] = await Promise.all([getMessages(), getCurrentUser()]);

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider messages={messages}>
          <AppProviders initialUser={user}>
            <Header />
            <main className="mx-auto max-w-[1280px] px-4 pb-24 md:px-8 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
