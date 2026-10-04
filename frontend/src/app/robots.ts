import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

// Signed-in and email-link pages have nothing worth indexing.
const PRIVATE_PATHS = ["/account", "/forgot-password", "/reset-password", "/verify-email", "/newsletter"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", ...routing.locales.flatMap((l) => PRIVATE_PATHS.map((p) => `/${l}${p}`))],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
