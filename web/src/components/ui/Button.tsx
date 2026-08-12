"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost:
    "bg-transparent text-on-surface-variant hover:text-secondary-fixed-dim font-mono text-label-caps uppercase tracking-widest",
  danger:
    "bg-transparent border border-error-bright/60 text-error-bright font-mono text-label-caps uppercase tracking-widest hover:bg-error-bright/10",
};

export function Button({
  variant = "primary",
  loading,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin motion-reduce:animate-none border border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
