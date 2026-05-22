// ── Metric / Dimension enums ──────────────────────────────────────────────────
export type ReportMetric =
  | "spend"
  | "clicks"
  | "impressions"
  | "conversions"
  | "revenue"
  | "ctr"
  | "cpc"
  | "roas";

export type ReportDimension = "platform" | "campaign" | "date" | "device" | "country";

export type ChartType = "line" | "bar" | "donut" | "table";

export type TrendPeriod = "daily" | "weekly";

// ── Filters ───────────────────────────────────────────────────────────────────
export interface ReportFilters {
  platform?: string[] | null;
  date_from?: string | null;
  date_to?: string | null;
}

// ── 4.1 Overview ─────────────────────────────────────────────────────────────
export interface KpiValue {
  value: number | null;
  delta: number | null; // % change vs prior period; null = no prior data
}

export interface OverviewKpis {
  spend: KpiValue;
  clicks: KpiValue;
  impressions: KpiValue;
  conversions: KpiValue;
  revenue: KpiValue;
  ctr: KpiValue;
  roas: KpiValue;
}

export interface OverviewData {
  kpis: OverviewKpis;
  date_from: string;
  date_to: string;
  platform: string | null;
}

// ── 4.2 Campaigns ─────────────────────────────────────────────────────────────
export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface CampaignsData {
  campaigns: CampaignRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CampaignsParams {
  platform?: string;
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  date_from?: string;
  date_to?: string;
}

// ── 4.3 Trend ─────────────────────────────────────────────────────────────────
export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface TrendData {
  metric: ReportMetric;
  period: TrendPeriod;
  data: TrendPoint[];
}

// ── 4.4 Custom report ─────────────────────────────────────────────────────────
export interface CustomReportRequest {
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  filters: ReportFilters;
  chart_type: ChartType;
}

export interface CustomReportData {
  data: Record<string, unknown>[];
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  chart_type: ChartType;
}

// ── 4.5 Saved reports ─────────────────────────────────────────────────────────
export interface SavedReport {
  _id: string;
  user_id: string;
  name: string;
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  filters: ReportFilters;
  chart_type: ChartType;
  created_at: string;
  updated_at: string;
  // Sharing
  share_token?: string | null;
  share_enabled?: boolean;
  share_url?: string | null;
  shared_at?: string | null;
}

export interface SaveReportRequest extends CustomReportRequest {
  name: string;
}
