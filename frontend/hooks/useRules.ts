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
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Request failed");
  return json.data as T;
}

export interface Rule {
  id: string;
  name: string;
  platform: string;
  connector_id: string;
  campaign_id: string | null;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  email_recipients: string[];
  cooldown_minutes: number;
  enabled: boolean;
  last_triggered_at: string | null;
  triggered_count: number;
  created_at: string;
  updated_at: string;
}

export interface RuleTrigger {
  id: string;
  rule_id: string;
  rule_name: string;
  campaign_id: string;
  campaign_name: string;
  platform: string;
  metric: string;
  operator: string;
  threshold: number;
  actual_value: number;
  action_taken: string;
  action_result: string | null;
  triggered_at: string;
}

export interface RuleCreate {
  name: string;
  platform: string;
  connector_id: string;
  campaign_id?: string;
  metric: string;
  operator: string;
  threshold: number;
  action?: string;
  email_recipients?: string[];
  cooldown_minutes?: number;
  enabled?: boolean;
}

export const METRICS = [
  { value: "spend", label: "Spend ($)" },
  { value: "impressions", label: "Impressions" },
  { value: "clicks", label: "Clicks" },
  { value: "ctr", label: "CTR (%)" },
  { value: "cpa", label: "CPA ($)" },
  { value: "roas", label: "ROAS" },
  { value: "cpm", label: "CPM ($)" },
  { value: "reach", label: "Reach" },
  { value: "conversions", label: "Conversions" },
];

export const OPERATORS = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
];

export const ACTIONS = [
  { value: "alert", label: "Log alert" },
  { value: "pause_campaign", label: "Pause campaign" },
  { value: "email", label: "Send email" },
];

export function useRules() {
  return useQuery<Rule[]>({
    queryKey: ["rules"],
    queryFn: () => apiFetch("/api/v1/rules"),
    staleTime: 60_000,
  });
}

export function useRuleHistory(ruleId?: string) {
  return useQuery<RuleTrigger[]>({
    queryKey: ["rule-history", ruleId],
    queryFn: () => apiFetch(`/api/v1/rules/history${ruleId ? `?rule_id=${ruleId}` : ""}`),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleCreate) =>
      apiFetch<Rule>("/api/v1/rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RuleCreate> & { id: string }) =>
      apiFetch<Rule>(`/api/v1/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEvaluateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ triggered_count: number }>("/api/v1/rules/evaluate", { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["rule-history"] });
      toast.success(`Evaluation complete — ${data.triggered_count} rule(s) triggered`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
