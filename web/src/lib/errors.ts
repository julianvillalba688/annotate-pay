import type { MessageKey, MessageValues } from "@/lib/i18n/messages";

type Translate = (key: MessageKey | string, values?: MessageValues) => string;

export function getUserError(
  error: unknown,
  t: Translate,
  fallback: MessageKey,
): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  if (raw.includes("analytics_unavailable")) {
    return t("errors.analyticsUnavailable");
  }
  if (raw.includes("auth") || raw.includes("session")) {
    return t("errors.notAuthenticated");
  }
  return t(fallback);
}
