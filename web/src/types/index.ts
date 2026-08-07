export type ProjectStatus = "active" | "archived" | "paused";

export interface Profile {
  id: string;
  email: string;
  global_hourly_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
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
  snapshot_aht_attempter: number;
  snapshot_aht_reviewer: number;
  hourly_rate_used: number;
  calculated_earnings: number;
  created_at: string;
  projects?: { id: string; name: string } | null;
}

export interface TaskLogInsert {
  project_id: string;
  date: string;
  tasks_attempter: number;
  tasks_reviewer: number;
  user_id: string;
  /** placeholders — DB trigger overwrites with snapshots */
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
  total_earned: number;
  total_tasks_attempter: number;
  total_tasks_reviewer: number;
  total_hours: number;
}

export interface AnalyticsSeriesPoint {
  key: string;
  label: string;
  earnings: number;
  tasks_attempter: number;
  tasks_reviewer: number;
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
