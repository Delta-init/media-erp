"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export type AttributionModel = "first_touch" | "last_touch" | "linear" | "time_decay";

export interface AttributionPlatform {
  platform:               string;
  weight_pct:             number;
  attributed_conversions: number;
  attributed_revenue:     number;
  spend:                  number;
  clicks:                 number;
  impressions:            number;
  ctr:                    number;
  cpc:                    number;
  roas:                   number;
}

export interface AttributionData {
  model:              AttributionModel;
  date_from:          string;
  date_to:            string;
  platforms:          AttributionPlatform[];
  total_conversions:  number;
  total_revenue:      number;
}

export function useAttribution(
  dateFrom: string,
  dateTo:   string,
  model:    AttributionModel,
) {
  return useQuery({
    queryKey: ["analytics", "attribution", dateFrom, dateTo, model],
    queryFn:  async () => {
      const { data } = await api.get<{ success: boolean; data: AttributionData }>(
        "/analytics/attribution",
        { params: { date_from: dateFrom, date_to: dateTo, model } },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}
