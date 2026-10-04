import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import type { SiteSettings } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function AdminSiteSettingsPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const settings = await backendFetch<SiteSettings>("/admin/site-settings", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return <SiteSettingsForm initialFooter={settings.footer} />;
}
