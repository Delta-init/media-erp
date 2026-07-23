import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Same-origin (relative) — never reference NEXT_PUBLIC_API_URL here even
// behind a typeof-window check: Next.js inlines its literal value into the
// client bundle for every reference regardless of reachability. See lib/axios.ts.
const API = "";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = API.replace(/\/api\/v1$/, "");
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Request failed");
  return json.data as T;
}

export interface Branding {
  user_id: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  footer_text: string;
  report_title_prefix: string | null;
  hide_mediaerp_branding: boolean;
  custom_font: string | null;
  updated_at: string | null;
}

export interface BrandingUpdate {
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  footer_text?: string;
  report_title_prefix?: string;
  hide_mediaerp_branding?: boolean;
}

export function useBranding() {
  return useQuery<Branding>({
    queryKey: ["whitelabel"],
    queryFn: () => apiFetch("/api/v1/whitelabel/settings"),
    staleTime: 300_000,
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BrandingUpdate) =>
      apiFetch<Branding>("/api/v1/whitelabel/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whitelabel"] });
      toast.success("Branding updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/v1/whitelabel/settings", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whitelabel"] });
      toast.success("Branding reset to defaults");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
