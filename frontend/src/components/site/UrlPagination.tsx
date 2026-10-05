"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";

export function UrlPagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    // replace: moving through result pages shouldn't add Back-button steps
    router.replace(`${pathname}?${params.toString()}`);
  };

  return <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />;
}
