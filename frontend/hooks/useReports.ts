"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  CampaignsData,
  CampaignsParams,
  CustomReportData,
  CustomReportRequest,
  OverviewData,
  SavedReport,
  SaveReportRequest,
  TrendData,
  TrendPeriod,
  ReportMetric,
} from "@/types/report";

// ── Query-key factories ───────────────────────────────────────────────────────
const QK = {
  overview: (dateFrom: string, dateTo: string, platform?: string | null) =>
    ["reports", "overview", dateFrom, dateTo, platform ?? "all"] as const,

  campaigns: (params: CampaignsParams) =>
    ["reports", "campaigns", params] as const,

  trend: (
    metric: ReportMetric,
    period: TrendPeriod,
    dateFrom: string,
    dateTo: string,
    platform?: string | null
  ) =>
    [
      "reports",
      "trend",
      metric,
      period,
      dateFrom,
      dateTo,
      platform ?? "all",
    ] as const,

  saved: () => ["reports", "saved"] as const,
  savedOne: (id: string) => ["reports", "saved", id] as const,
};

// ── 4.1 Overview KPIs ────────────────────────────────────────────────────────
export function useOverview(
  dateFrom: string,
  dateTo: string,
  platform?: string | null
) {
  return useQuery({
    queryKey: QK.overview(dateFrom, dateTo, platform),
    queryFn: async () => {
      const params: Record<string, string> = {
        date_from: dateFrom,
        date_to: dateTo,
      };
      if (platform) params.platform = platform;
      const { data } = await api.get<{ success: boolean; data: OverviewData }>(
        "/reports/overview",
        { params }
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── 4.2 Campaigns table ──────────────────────────────────────────────────────
export function useCampaigns(params: CampaignsParams) {
  return useQuery({
    queryKey: QK.campaigns(params),
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: CampaignsData;
      }>("/reports/campaigns", { params });
      return data.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev, // keep old data while loading new page
  });
}

// ── 4.3 Trend chart ──────────────────────────────────────────────────────────
export function useTrend(
  metric: ReportMetric,
  period: TrendPeriod,
  dateFrom: string,
  dateTo: string,
  platform?: string | null
) {
  return useQuery({
    queryKey: QK.trend(metric, period, dateFrom, dateTo, platform),
    queryFn: async () => {
      const params: Record<string, string> = {
        metric,
        period,
        date_from: dateFrom,
        date_to: dateTo,
      };
      if (platform) params.platform = platform;
      const { data } = await api.get<{ success: boolean; data: TrendData }>(
        "/reports/trend",
        { params }
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── 4.4 Custom report ────────────────────────────────────────────────────────
export function useCustomReport() {
  return useMutation({
    mutationFn: async (body: CustomReportRequest) => {
      const { data } = await api.post<{
        success: boolean;
        data: CustomReportData;
      }>("/reports/custom", body);
      return data.data;
    },
    onError() {
      toast.error("Failed to generate report");
    },
  });
}

// ── 4.5 Saved reports ────────────────────────────────────────────────────────
export function useSavedReports() {
  return useQuery({
    queryKey: QK.saved(),
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: SavedReport[];
      }>("/reports/saved");
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useSavedReport(id: string) {
  return useQuery({
    queryKey: QK.savedOne(id),
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: SavedReport;
      }>(`/reports/saved/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SaveReportRequest) => {
      const { data } = await api.post<{
        success: boolean;
        data: SavedReport;
      }>("/reports/saved", body);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.saved() });
      toast.success("Report saved");
    },
    onError() {
      toast.error("Failed to save report");
    },
  });
}

export function useDeleteSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reports/saved/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.saved() });
      toast.success("Report deleted");
    },
    onError() {
      toast.error("Failed to delete report");
    },
  });
}

// ── Data blend ────────────────────────────────────────────────────────────────

export interface BlendSource {
  platform: string;
  metrics: string[];
}

export interface BlendSeries {
  key: string;      // "google_ads.spend"
  platform: string;
  metric: string;
  data: number[];   // value per date (index-aligned to dates array)
}

export interface BlendData {
  dates: string[];
  series: BlendSeries[];
  date_from: string;
  date_to: string;
}

export function useBlendReport() {
  return useMutation({
    mutationFn: async (body: {
      sources: BlendSource[];
      date_from?: string;
      date_to?: string;
    }) => {
      const { data } = await api.post<{ success: boolean; data: BlendData }>(
        "/reports/blend",
        body
      );
      return data.data;
    },
    onError() {
      toast.error("Failed to generate blend report");
    },
  });
}

// ── Report sharing ─────────────────────────────────────────────────────────────

export function useShareReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data } = await api.post<{
        success: boolean;
        data: { share_token: string; share_url: string };
      }>(`/reports/saved/${reportId}/share`);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.saved() });
      toast.success("Share link created");
    },
    onError() {
      toast.error("Failed to create share link");
    },
  });
}

export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      await api.delete(`/reports/saved/${reportId}/share`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.saved() });
      toast.success("Share link revoked");
    },
    onError() {
      toast.error("Failed to revoke share link");
    },
  });
}

export function useSharedReport(token: string) {
  return useQuery({
    queryKey: ["reports", "shared", token],
    queryFn: async () => {
      // Public endpoint — no auth header needed. Same-origin (relative) so the
      // backend's real host never appears in the browser — see lib/axios.ts.
      // (Never reference NEXT_PUBLIC_API_URL here, even conditionally: its
      // literal value gets inlined into the client bundle for every reference.)
      const res = await fetch(`/api/v1/reports/shared/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Report not found");
      return json.data as { report: SavedReport; data: { data: Record<string, unknown>[]; metrics: string[]; dimensions: string[]; chart_type: string } };
    },
    enabled: !!token,
    retry: false,
  });
}

// ── 4.6 CSV Export ───────────────────────────────────────────────────────────
export function useExportCsv() {
  return useMutation({
    mutationFn: async ({
      metrics,
      dimensions,
      platform,
      dateFrom,
      dateTo,
    }: {
      metrics: string[];
      dimensions: string[];
      platform?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    }) => {
      const params = new URLSearchParams();
      if (metrics.length) params.set("metrics", metrics.join(","));
      if (dimensions.length) params.set("dimensions", dimensions.join(","));
      if (platform) params.set("platform", platform);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const { data: blob } = await api.get<Blob>(`/reports/export?${params}`, {
        responseType: "blob",
      });

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess() {
      toast.success("CSV downloaded");
    },
    onError() {
      toast.error("Failed to export CSV");
    },
  });
}
