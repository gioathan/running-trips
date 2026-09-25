import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AdminAuthProvider } from "@/lib/admin-auth-context";
import { getCurrentAdmin } from "@/lib/auth-server";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ΑΛΛΟΥ — Admin",
  robots: { index: false, follow: false },
};

// Admin is a separate, English-only internal tool — no locale prefix, no
// public nav entry, per BACKEND_PLAN.md §5/§6's separate admin auth path.
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink">
        <AdminAuthProvider initialAdmin={admin}>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
