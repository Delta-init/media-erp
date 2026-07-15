import type { User } from "@/types/user";

export type NotifCategory = "employee" | "leader" | "elevated";

export interface NotifDef {
  key: string;
  label: string;
  desc: string;
}

// Per-user, role-aware notification types (shown in Profile + Settings).
export const NOTIF_DEFS: Record<NotifCategory, NotifDef[]> = {
  employee: [
    { key: "task_assigned",     label: "Task Assigned",       desc: "When a new task is assigned to you" },
    { key: "pending_review",    label: "Review Acknowledged", desc: "When your task enters pending review" },
    { key: "task_approved",     label: "Task Approved",       desc: "When your task is approved by a leader" },
    { key: "task_reedit",       label: "Sent for Revision",   desc: "When your task is returned for revision" },
    { key: "due_date_reminder", label: "Due Date Reminder",   desc: "When a task is due the next day" },
  ],
  leader: [
    { key: "team_task_assigned", label: "New Team Task",     desc: "When new work is assigned to your team" },
    { key: "pending_review",     label: "Pending Review",    desc: "When a team member submits a task for your review" },
    { key: "task_approved",      label: "Task Approved",     desc: "When a task in your team is approved" },
    { key: "task_reedit",        label: "Sent for Revision", desc: "When a task is returned to a member for revision" },
    { key: "task_started",       label: "Task Started",      desc: "When a team member begins working on a task" },
    { key: "task_break",         label: "Task Paused",       desc: "When a team member takes a break on a task" },
  ],
  elevated: [
    { key: "team_task_assigned", label: "Task Assigned",     desc: "When any task is assigned to a team" },
    { key: "pending_review",     label: "Pending Review",    desc: "When any task is submitted for review" },
    { key: "task_approved",      label: "Task Approved",     desc: "When any task is approved" },
    { key: "task_reedit",        label: "Sent for Revision", desc: "When any task is sent back for revision" },
  ],
};

export const ROLE_LABEL: Record<NotifCategory, string> = {
  employee: "Employee",
  leader:   "Team Leader",
  elevated: "Admin / Coordinator / Super Admin",
};

export function getNotifCategory(user: User | null): NotifCategory {
  if (!user?.role) return "employee";
  if (user.role.is_system_role) return "elevated";
  const n = (user.role.role_name ?? "").toLowerCase();
  if (n.includes("leader") || n.includes("manager") || n.includes("supervisor")) return "leader";
  return "employee";
}

// Flat list of every email type — used for the team-level (leader) settings.
export const TEAM_EMAIL_TYPES: NotifDef[] = [
  { key: "team_task_assigned", label: "New Team Task",     desc: "New work is added to the team" },
  { key: "task_assigned",      label: "Task Assigned",     desc: "A task is assigned to a member" },
  { key: "task_started",       label: "Task Started",      desc: "A member starts a task" },
  { key: "task_break",         label: "Task Paused",       desc: "A member takes a break" },
  { key: "pending_review",     label: "Pending Review",    desc: "A task is submitted for review" },
  { key: "task_approved",      label: "Task Approved",     desc: "A task is approved" },
  { key: "task_reedit",        label: "Sent for Revision", desc: "A task is returned for revision" },
  { key: "due_date_reminder", label: "Due Date Reminder",  desc: "A task is due soon" },
];
