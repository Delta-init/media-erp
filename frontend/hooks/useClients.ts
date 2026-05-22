import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

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

export interface Client {
  id: string;
  agency_user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  color: string;
  status: "active" | "inactive" | "prospect";
  invite_token: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  connector_count: number;
  total_spend_30d: number;
  created_at: string;
  updated_at: string;
}

export interface AgencyStats {
  total_clients: number;
  active_clients: number;
  prospect_clients: number;
  total_spend_30d: number;
}

export interface ClientCreate {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  notes?: string;
  color?: string;
}

export const INDUSTRIES = [
  "E-commerce", "SaaS", "Healthcare", "Finance", "Real Estate",
  "Education", "Media", "Retail", "Travel", "Food & Beverage", "Other",
];

export const CLIENT_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

export function useClients(status?: string) {
  return useQuery<Client[]>({
    queryKey: ["clients", status],
    queryFn: () => apiFetch(`/api/v1/clients${status ? `?status=${status}` : ""}`),
    staleTime: 60_000,
  });
}

export function useAgencyStats() {
  return useQuery<AgencyStats>({
    queryKey: ["agency-stats"],
    queryFn: () => apiFetch("/api/v1/clients/stats"),
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientCreate) =>
      apiFetch<Client>("/api/v1/clients", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["agency-stats"] });
      toast.success("Client created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ClientCreate> & { id: string; status?: string }) =>
      apiFetch<Client>(`/api/v1/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["agency-stats"] });
      toast.success("Client deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInviteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ invite_token: string; invited_at: string }>(`/api/v1/clients/${id}/invite`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Invitation sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
