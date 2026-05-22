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

export interface PlanLimits {
  connectors: number;
  users: number;
  data_retention_days: number;
  scheduled_posts: number;
  clients: number;
  email_reports: number;
  rules: number;
  export: boolean;
  white_label: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: PlanLimits;
  features: string[];
  highlighted: boolean;
}

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  billing_period: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageItem {
  used: number;
  limit: number;
  pct: number;
}

export interface Usage {
  connectors: UsageItem;
  users: UsageItem;
  rules: UsageItem;
  email_reports: UsageItem;
  clients: UsageItem;
  scheduled_posts: UsageItem;
}

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ["billing-plans"],
    queryFn: () => apiFetch("/api/v1/billing/plans"),
    staleTime: Infinity,
  });
}

export function useSubscription() {
  return useQuery<{ subscription: Subscription; plan: Plan; stripe_available: boolean }>({
    queryKey: ["billing-subscription"],
    queryFn: () => apiFetch("/api/v1/billing/subscription"),
    staleTime: 300_000,
  });
}

export function useUsage() {
  return useQuery<{ usage: Usage; plan: string; features: PlanLimits }>({
    queryKey: ["billing-usage"],
    queryFn: () => apiFetch("/api/v1/billing/usage"),
    staleTime: 60_000,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (body: { plan_id: string; billing_period: "monthly" | "yearly" }) =>
      apiFetch<{ checkout_url?: string; demo_mode?: boolean }>("/api/v1/billing/create-checkout", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      if (data.demo_mode) {
        toast.info("Demo mode: configure STRIPE_SECRET_KEY in .env to enable live payments");
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePortal() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ portal_url?: string; demo_mode?: boolean }>("/api/v1/billing/create-portal", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      if (data.demo_mode) {
        toast.info("Demo mode: configure Stripe to access billing portal");
      } else if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
