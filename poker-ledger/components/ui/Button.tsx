import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-gold text-ink shadow-[0_4px_14px_rgba(0,0,0,0.3)]",
  secondary: "glass text-ivory",
  ghost: "text-gold-soft underline-offset-4 hover:underline",
  danger: "glass text-loss-soft",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-sm",
  md: "min-h-11 px-5 text-base",
  lg: "min-h-13 px-6 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", href, className = "", children, ...rest }: Props) {
  const cls = buttonClass(variant, size, className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
