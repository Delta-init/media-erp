import type { Role } from "@/types/role";

export interface User {
  id: string;
  email: string;
  name: string;
  /** Populated role object (null for legacy users without role_id). */
  role: Role | null;
  role_id: string;
  designation: string;
  status: "active" | "inactive";
  plan: "free" | "pro" | "enterprise";
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}
