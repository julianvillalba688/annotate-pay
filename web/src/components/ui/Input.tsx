"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

interface TerminalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  showPrompt?: boolean;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function TerminalInput({
  label,
  showPrompt = true,
  hint,
  error,
  className,
  wrapperClassName,
  id,
  ...props
}: TerminalInputProps) {
  const inputId = id || props.name;
  return (
    <div className={cn("space-y-1", wrapperClassName)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="block font-mono text-label-caps text-primary-container uppercase"
        >
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {showPrompt ? (
          <span className="absolute left-0 text-secondary-container font-mono text-data-lg pointer-events-none select-none">
            &gt;
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "terminal-input py-2 font-mono text-data-sm block focus:ring-0",
            showPrompt ? "pl-6" : "pl-0",
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="font-mono text-[11px] text-error-bright">{error}</p>
      ) : hint ? (
        <p className="font-mono text-[10px] text-outline">{hint}</p>
      ) : null}
    </div>
  );
}

interface TerminalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  showPrompt?: boolean;
  error?: string;
  children: ReactNode;
}

export function TerminalSelect({
  label,
  showPrompt = true,
  error,
  className,
  id,
  children,
  ...props
}: TerminalSelectProps) {
  const inputId = id || props.name;
  return (
    <div className="space-y-1">
      {label ? (
        <label
          htmlFor={inputId}
          className="block font-mono text-label-caps text-on-surface-variant uppercase tracking-widest"
        >
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {showPrompt ? (
          <span className="absolute left-0 text-secondary-container font-mono text-data-lg pointer-events-none z-10 select-none">
            &gt;
          </span>
        ) : null}
        <select
          id={inputId}
          className={cn(
            "terminal-input py-2.5 font-mono text-data-sm appearance-none cursor-pointer focus:ring-0 pr-8",
            showPrompt ? "pl-6" : "pl-2",
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
      {error ? (
        <p className="font-mono text-[11px] text-error-bright">{error}</p>
      ) : null}
    </div>
  );
} 
