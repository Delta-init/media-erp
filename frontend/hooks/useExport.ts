const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ExportParams {
  platform?: string;
  connector_id?: string;
  campaign_id?: string;
  date_from?: string;
  date_to?: string;
}

async function triggerDownload(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Export failed");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function buildQuery(params: ExportParams): string {
  const q = new URLSearchParams();
  if (params.platform) q.set("platform", params.platform);
  if (params.connector_id) q.set("connector_id", params.connector_id);
  if (params.campaign_id) q.set("campaign_id", params.campaign_id);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  return q.toString() ? `?${q.toString()}` : "";
}

export function useExport() {
  const exportExcel = async (params: ExportParams = {}) => {
    const df = params.date_from ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const dt = params.date_to   ?? new Date().toISOString().slice(0, 10);
    const filename = `mediaerp_campaigns_${df}_${dt}.xlsx`;
    await triggerDownload(
      `${API}/api/v1/export/campaigns/excel${buildQuery(params)}`,
      filename
    );
  };

  const exportPdf = async (params: ExportParams = {}) => {
    const df = params.date_from ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const dt = params.date_to   ?? new Date().toISOString().slice(0, 10);
    const filename = `mediaerp_campaigns_${df}_${dt}.pdf`;
    await triggerDownload(
      `${API}/api/v1/export/campaigns/pdf${buildQuery(params)}`,
      filename
    );
  };

  return { exportExcel, exportPdf };
}
