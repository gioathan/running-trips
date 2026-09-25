"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { rememberMe: false } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password, values.rememberMe);
      onDone();
    } catch (err) {
      setServerError(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="login-email">{t("emailLabel")}</Label>
        <Input id="login-email" type="email" autoComplete="email" {...register("email")} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="mb-0">
            {t("passwordLabel")}
          </Label>
          <Link href="/forgot-password" className="text-label-md text-ink-muted underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <Input id="login-password" type="password" autoComplete="current-password" {...register("password")} />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      <Controller
        name="rememberMe"
        control={control}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-body-md">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            {t("rememberMe")}
          </label>
        )}
      />
      {serverError && <FieldError>{serverError}</FieldError>}
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t("logIn")}
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const { signup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signup(values.email, values.password, values.fullName, locale);
      onDone();
    } catch (err) {
      setServerError(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="signup-name">{t("fullNameLabel")}</Label>
        <Input id="signup-name" autoComplete="name" {...register("fullName")} />
        <FieldError>{errors.fullName?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="signup-email">{t("emailLabel")}</Label>
        <Input id="signup-email" type="email" autoComplete="email" {...register("email")} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="signup-password">{t("passwordLabel")}</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" {...register("password")} />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      {serverError && <FieldError>{serverError}</FieldError>}
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t("signUp")}
      </Button>
    </form>
  );
}

export function LoginModal() {
  const { isOpen, initialTab, onSuccess, close } = useLoginModal();
  const [tab, setTab] = useState<"login" | "signup">(initialTab);
  const t = useTranslations("auth");

  const handleDone = () => {
    close();
    onSuccess?.();
  };

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && close()} title={t("modalTitle")} hideTitle>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
        <Tabs.List className="mb-6 flex rounded-full bg-surface-low p-1">
          <Tabs.Trigger
            value="login"
            className="flex-1 rounded-full py-2 text-label-lg uppercase data-[state=active]:bg-white data-[state=active]:shadow-hard"
          >
            {t("logIn")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="signup"
            className="flex-1 rounded-full py-2 text-label-lg uppercase data-[state=active]:bg-white data-[state=active]:shadow-hard"
          >
            {t("signUp")}
          </Tabs.Trigger>
        </Tabs.List>

        <GoogleSignInButton onSuccess={handleDone} />

        <div className="my-6 flex items-center gap-4 text-label-md text-ink-muted">
          <div className="h-px flex-1 bg-ink/10" />
          {t("or")}
          <div className="h-px flex-1 bg-ink/10" />
        </div>

        <Tabs.Content value="login">
          <LoginForm onDone={handleDone} />
        </Tabs.Content>
        <Tabs.Content value="signup">
          <SignupForm onDone={handleDone} />
        </Tabs.Content>
      </Tabs.Root>
      <p className="mt-6 text-center text-body-sm text-ink-muted">{t("consent")}</p>
    </Modal>
  );
}
