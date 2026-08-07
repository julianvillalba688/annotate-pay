import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<Tone, string> = {
  success:
    "bg-tertiary/10 text-tertiary border border-tertiary/30",
  warning:
    "bg-primary-container/10 text-primary border border-primary-container/30",
  danger:
    "bg-error-bright/10 text-error-bright border border-error-bright/30",
  info: "bg-secondary-container/10 text-secondary-container border border-secondary-container/30",
  neutral:
    "bg-surface-variant/40 text-on-surface-variant border border-outline-variant/40",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 font-mono text-label-caps uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
