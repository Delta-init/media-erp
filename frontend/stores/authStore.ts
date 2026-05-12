import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

const isBrowser = typeof window !== "undefined";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setAuth(user, accessToken, refreshToken) {
        if (isBrowser) {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
          // Cookie read by middleware for SSR-safe route protection
          document.cookie = `access_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        set({ user, isAuthenticated: true });
      },

      clearAuth() {
        if (isBrowser) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          document.cookie = "access_token=; path=/; max-age=0";
        }
        set({ user: null, isAuthenticated: false });
      },

      hasPermission(module: string, action: string): boolean {
        const { user } = get();
        // No role assigned (legacy user) → treat as full access so the UI isn't blank
        if (!user?.role) return true;
        // Super Admin bypasses all checks
        if (user.role.is_system_role && user.role.role_name === "Super Admin") return true;
        return user.role.permissions?.[module]?.[action as keyof typeof user.role.permissions[string]] === true;
      },
    }),
    {
      name: "auth",
      // Only persist display state — tokens stay in localStorage directly
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
