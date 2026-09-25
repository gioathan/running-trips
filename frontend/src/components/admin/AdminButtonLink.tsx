import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface AdminButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}

// Same visual variants as components/ui/Button, but using plain next/link —
// admin routes have no locale prefix, so the i18n-aware Link/ButtonLink
// (which would prepend /en or /el) is wrong here.
export function AdminButtonLink({ href, variant = "primary", className, children, ...props }: AdminButtonLinkProps) {
  const variantClasses = {
    primary: "bg-primary text-ink hover:shadow-hard",
    secondary: "bg-ink text-white hover:bg-ink/90",
    ghost: "bg-transparent text-ink border border-ink hover:bg-surface",
  }[variant];

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-label-lg uppercase transition-shadow",
        variantClasses,
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
