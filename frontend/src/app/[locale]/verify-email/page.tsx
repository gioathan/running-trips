"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Feedback";
import { apiFetch } from "@/lib/api";

export default function VerifyEmailPage() {
  const t = useTranslations("verifyEmail");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="mx-auto max-w-[440px] py-16 text-center">
      <Card className="p-8">
        {status === "pending" && <Spinner className="mx-auto" />}
        {status === "success" && <p className="text-body-lg">{t("success")}</p>}
        {status === "error" && <p className="text-body-lg text-error">{t("error")}</p>}
        <Link href="/" className="mt-6 inline-block text-body-md underline">
          {t("backToHome")}
        </Link>
      </Card>
    </div>
  );
}
