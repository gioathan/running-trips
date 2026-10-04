import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { ContentPageEditor } from "@/components/admin/ContentPageEditor";
import type { ContentPageAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SLUGS = ["home", "services", "contact"] as const;

export default async function AdminContentPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const headers = { Authorization: `Bearer ${accessToken}` };
  const pages = await Promise.all(
    PAGE_SLUGS.map((slug) =>
      backendFetch<ContentPageAdmin>(`/admin/content/pages/${slug}`, { headers, cache: "no-store" })
    )
  );

  return <ContentPageEditor pages={pages} />;
}
