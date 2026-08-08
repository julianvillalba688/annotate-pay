import type { PaymentStatus } from "@/types";

/** Missing status values remain understandable as pending, but are not treated as authoritative. */
export function resolvePaymentStatus(value: unknown): {
  status: PaymentStatus;
  available: boolean;
} {
  if (value === "paid") return { status: "paid", available: true };
  if (value === "pending") return { status: "pending", available: true };
  return { status: "pending", available: false };
}

/**
 * PostgREST reports a missing column as PGRST204, while direct PostgreSQL
 * errors use 42703. Require both the payment column name and a missing-column
 * signal so unrelated insert failures are never retried.
 */
export function isPaymentStatusSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!/\bpayment_status\b/.test(text)) return false;
  if (!/\b(?:column|field)\b/.test(text)) return false;
  if (!/\b(?:could not find|does not exist|not found|missing|undefined)\b/.test(text)) {
    return false;
  }

  return code === "" || code === "PGRST204" || code === "42703";
}
