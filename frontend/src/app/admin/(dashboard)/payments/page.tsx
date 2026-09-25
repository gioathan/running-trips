import { ComingSoon } from "@/components/admin/ComingSoon";

export default function AdminPaymentsPage() {
  return (
    <ComingSoon
      title="Payments"
      note="No admin list endpoint exists on the backend yet (payments/router.py only has create-intent, get-by-id, and the webhook) — add a paginated GET /admin/payments before building this page."
    />
  );
}
