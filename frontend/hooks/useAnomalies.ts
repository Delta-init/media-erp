"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface Anomaly {
  platform:      string;
  date:          string;
  metric:        string;
  value:         number;
  expected_mean: number;
  expected_std:  number;
  z_score:       number;
  severity:      "mild" | "severe";
  direction:     "spike" | "drop";
  pct_change:    number | null;
}

export interface AnomalyData {
  anomalies: Anomaly[];
  date_from: string;
  date_to:   string;
  metrics:   string[];
  count:     number;
}

export function useAnomalies(
  dateFrom: string,
  dateTo:   string,
  metrics?: string[],
) {
  return useQuery({
    queryKey: ["analytics", "anomalies", dateFrom, dateTo, metrics],
    queryFn:  async () => {
      const params: Record<string, string> = {
        date_from: dateFrom,
        date_to:   dateTo,
      };
      if (metrics?.length) params.metrics = metrics.join(",");

      const { data } = await api.get<{ success: boolean; data: AnomalyData }>(
        "/analytics/anomalies",
        { params },
      );
      return data.data;
    },
    staleTime: 120_000,
  });
}
