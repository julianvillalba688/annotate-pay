import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface-card cyber-border",
        glow && "shadow-glow-cyan-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  zebra = true,
}: {
  children: ReactNode;
  className?: string;
  zebra?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-electric/20 px-4 py-2",
        zebra && "zebra-header",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-on-surface-variant">
      {icon ? <div className="opacity-50 mb-1">{icon}</div> : null}
      <p className="font-mono text-data-sm uppercase tracking-wider">{title}</p>
      {subtitle ? (
        <p className="font-mono text-[11px] text-outline max-w-sm">{subtitle}</p>
      ) : null}
      <p className="font-mono text-[10px] text-outline/60 mt-2">
        &gt; awaiting_input...
      </p>
    </div>
  );
}

export function LoadingBlock({ label = "LOADING..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-secondary-container">
      <span className="inline-block h-3 w-3 animate-spin border border-secondary-container border-t-transparent" />
      <span className="font-mono text-data-sm tracking-widest">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-error-bright bg-error-container/20 p-4">
      <p className="font-mono text-data-sm text-error-bright uppercase">
        ERR_NODE_FAULT
      </p>
      <p className="font-mono text-[12px] text-error mt-1">{message}</p>
    </div>
  );
}
