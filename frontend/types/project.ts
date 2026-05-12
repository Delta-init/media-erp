export type TaskStatus =
  | "pending"
  | "upcoming"
  | "currently_working"
  | "updation_needed";

export type TaskPriority = "low" | "medium" | "high";

export type DateFilterOption =
  | ""
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "custom";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string;
  due_date?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string;
  due_date?: string | null;
}

export interface ProjectFilters {
  search: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  date_filter: DateFilterOption;
  date_from: string;
  date_to: string;
}

export const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: "pending",           label: "Pending",           color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" },
  { id: "upcoming",          label: "Upcoming",           color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  { id: "currently_working", label: "Currently Working",  color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  { id: "updation_needed",   label: "Updation Needed",    color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
];

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  high:   { label: "High",   color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};
