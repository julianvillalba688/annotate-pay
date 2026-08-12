export type ProjectStatus = "active" | "archived" | "paused";
export type PaymentStatus = "pending" | "paid";
export type OnboardingStatus = "pending" | "skipped" | "completed";
export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "MXN"
  | "COP"
  | "BRL"
  | "JPY";

export interface Profile {
  id: string;
  email: string;
  /** Canonical accounting rate in USD. */
  global_hourly_rate: number;
  preferred_locale?: "en" | "es" | null;
  preferred_currency?: CurrencyCode | null;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  /** AHT values are stored in minutes. */
  current_aht_attempter: number;
  current_aht_reviewer: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskLog {
  id: string;
  user_id: string;
  project_id: string;
  date: string;
  tasks_attempter: number;
  tasks_reviewer: number;
  /** Historical AHT snapshots are stored in minutes. */
  snapshot_aht_attempter: number;
  snapshot_aht_reviewer: number;
  /** Canonical accounting fields are stored in USD. */
  currency_code?: "USD";
  fx_rate_to_usd?: number;
  calculated_earnings_usd?: number;
  /** Compatibility field; canonical value is USD. */
  hourly_rate_used: number;
  calculated_earnings: number;
  payment_status: PaymentStatus;
  /** False when an older API/database row omitted the migrated status field. */
  payment_status_available?: boolean;
  paid_at?: string | null;
  created_at: string;
  projects?: { id: string; name: string } | null;
}

export interface TaskLogInsert {
  project_id: string;
  date: string;
  tasks_attempter: number;
  tasks_reviewer: number;
  user_id: string;
  payment_status: PaymentStatus;
  /** Safe placeholders — the DB trigger overwrites snapshots and USD rate. */
  snapshot_aht_attempter?: number;
  snapshot_aht_reviewer?: number;
  hourly_rate_used?: number;
}

export interface ProjectInsert {
  name: string;
  current_aht_attempter: number;
  current_aht_reviewer: number;
  status: ProjectStatus;
  user_id: string;
}

export interface ProjectUpdate {
  name?: string;
  current_aht_attempter?: number;
  current_aht_reviewer?: number;
  status?: ProjectStatus;
}

export interface AnalyticsKpis {
  /** Canonical USD total; display conversion happens in the UI. */
  total_earned: number;
  /** Optional for compatibility with analytics APIs before payment bookkeeping. */
  total_paid?: number;
  total_pending?: number;
  total_tasks_attempter: number;
  total_tasks_reviewer: number;
  /** Optional combined task count for analytics APIs that expose it. */
  total_tasks_completed?: number;
  total_hours: number;
}

export interface AnalyticsSeriesPoint {
  key: string;
  label: string;
  /** Canonical USD series value; display conversion happens in the UI. */
  earnings: number;
  /** Optional payment breakdown returned by the analytics API. */
  paid?: number;
  pending?: number;
  tasks_attempter: number;
  tasks_reviewer: number;
  /** Optional combined task count returned by newer analytics APIs. */
  tasks_completed?: number;
  hours: number;
}

export interface AnalyticsSummary {
  kpis: AnalyticsKpis;
  series: AnalyticsSeriesPoint[];
}

export type GroupBy = "month" | "project";

export interface AnalyticsFilters {
  project_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  group_by?: GroupBy;
}
