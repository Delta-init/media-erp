export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

export interface Role {
  id: string;
  role_name: string;
  description: string;
  is_system_role: boolean;
  permissions: Record<string, ModulePermissions>;
  created_at: string;
  updated_at: string;
}

export const MODULES = [
  "dashboard",
  "connectors",
  "reports",
  "campaigns",
  "projects",
  "teams",
  "ai",
  "users",
  "roles",
  "settings",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "export"] as const;
export type ActionKey = (typeof ACTIONS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Overview",
  connectors: "Connectors",
  reports: "Reports",
  campaigns: "Campaigns",
  projects: "Projects",
  teams: "Teams",
  ai: "AI Queries",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
};

export function emptyPermissions(): Record<string, ModulePermissions> {
  return Object.fromEntries(
    MODULES.map((m) => [m, { view: false, create: false, edit: false, delete: false, export: false }])
  );
}
