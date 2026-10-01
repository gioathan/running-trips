"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

export function LogoutButton({ className, children }: { className?: string; children?: ReactNode }) {
  const t = useTranslations("nav");
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("logOut")} className={className}>
        {children ?? t("logOut")}
      </button>
      <Modal open={open} onOpenChange={setOpen} title={t("logOutConfirmTitle")}>
        <p className="text-body-md text-ink-muted">{t("logOutConfirmBody")}</p>
        <div className="mt-8 flex justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={confirmLogout} disabled={isLoggingOut}>
            {t("logOut")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
