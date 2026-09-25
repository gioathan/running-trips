import { ComingSoon } from "@/components/admin/ComingSoon";

export default function AdminContentPage() {
  return (
    <ComingSoon
      title="Content Pages"
      note="Backend CRUD exists (GET/PATCH /admin/content/pages/{slug}) with a full-replace section list — build a per-page-slug editor with an add/remove/reorder section list, each section type having its own small form matching src/components/site/sections/types.ts."
    />
  );
}
