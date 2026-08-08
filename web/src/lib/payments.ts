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
