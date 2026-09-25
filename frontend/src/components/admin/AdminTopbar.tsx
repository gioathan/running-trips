"use client";

import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
}

export function AdminTopbar({ admin }: { admin: AdminUser }) {
  const router = useRouter();
  const { logout } = useAdminAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/admin/login");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-ink/10 bg-white px-6 md:px-10">
      <p className="text-body-md text-ink-muted">Admin</p>
      <div className="flex items-center gap-4">
        <p className="text-body-md">{admin.full_name ?? admin.email}</p>
        <button type="button" onClick={onLogout} className="text-body-md text-ink-muted underline">
          Log out
        </button>
      </div>
    </header>
  );
}
