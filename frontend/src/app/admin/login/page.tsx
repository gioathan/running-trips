"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";

interface FormValues {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { admin, login } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  useEffect(() => {
    if (admin) router.replace("/admin");
  }, [admin, router]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message || "Invalid credentials" : "Something went wrong");
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-[400px] p-8">
        <h1 className="text-headline-sm">ΑΛΛΟΥ Admin</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required {...register("email", { required: true })} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required {...register("password", { required: true })} />
          </div>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            Log in
          </Button>
        </form>
      </Card>
    </div>
  );
}
