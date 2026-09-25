import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Variant = "primary" | "highlight" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
}

// Variant styling per docs/DESIGN_SYSTEM.md "Components > Buttons".
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-ink hover:shadow-hard",
  highlight: "bg-accent text-ink hover:shadow-hard",
  secondary: "bg-ink text-white hover:bg-ink/90",
  ghost: "bg-transparent text-ink border border-ink hover:bg-surface",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-sans text-label-lg uppercase transition-shadow disabled:opacity-50 disabled:cursor-not-allowed",
          size === "md" ? "h-12 px-8" : "h-10 px-6",
          VARIANT_CLASSES[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: "md" | "sm";
}

/** Same visual variants as `Button`, for CTAs that navigate — a styled
 * `Link`, not a `<button>` wrapping an `<a>`. */
export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...props }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-sans text-label-lg uppercase transition-shadow",
        size === "md" ? "h-12 px-8" : "h-10 px-6",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
