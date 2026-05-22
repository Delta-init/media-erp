import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Request failed");
  return json.data as T;
}

export interface EmailSchedule {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  send_time: string;
  recipients: string[];
  platforms: string[];
  date_range_days: number;
  enabled: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailScheduleCreate {
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  send_time?: string;
  recipients: string[];
  platforms?: string[];
  date_range_days?: number;
  enabled?: boolean;
}

export const PLATFORMS = [
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram_login", label: "Instagram" },
  { value: "ga4", label: "Google Analytics 4" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "facebook_pages", label: "Facebook Pages" },
];

export const DOW_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function useEmailSchedules() {
  return useQuery<EmailSchedule[]>({
    queryKey: ["email-schedules"],
    queryFn: () => apiFetch("/api/v1/email-reports/schedules"),
    staleTime: 60_000,
  });
}

export function useCreateEmailSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EmailScheduleCreate) =>
      apiFetch<EmailSchedule>("/api/v1/email-reports/schedules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-schedules"] });
      toast.success("Email schedule created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEmailSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<EmailScheduleCreate> & { id: string }) =>
      apiFetch<EmailSchedule>(`/api/v1/email-reports/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-schedules"] });
      toast.success("Schedule updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEmailSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/email-reports/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ status: string; rows_sent: number; next_send_at: string }>(
        `/api/v1/email-reports/send-now/${id}`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-schedules"] });
      toast.success(`Report sent (${data.rows_sent} rows)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (recipient: string) =>
      apiFetch("/api/v1/email-reports/test-email", {
        method: "POST",
        body: JSON.stringify({ recipient }),
      }),
    onSuccess: () => toast.success("Test email sent — check your inbox"),
    onError: (e: Error) => toast.error(e.message),
  });
}
