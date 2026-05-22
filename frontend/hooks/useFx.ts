"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface FxData {
  base:       string;
  rates:      Record<string, number>;
  currencies: string[];
}

export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD",
  "JPY", "CHF", "SGD", "INR", "BRL",
] as const;

export type Currency = typeof SUPPORTED_CURRENCIES[number];

export function useFx(base: string = "USD") {
  return useQuery({
    queryKey: ["fx", "rates", base],
    queryFn:  async () => {
      const { data } = await api.get<{ success: boolean; data: FxData }>(
        "/fx/rates",
        { params: { base } },
      );
      return data.data;
    },
    staleTime: 3_600_000,  // 1 h — rates change slowly
    enabled: !!base,
  });
}

/** Convert a USD value to the target currency using the provided rates dict. */
export function convertValue(
  usdValue: number,
  currency: string,
  rates: Record<string, number>,
): number {
  if (currency === "USD" || !rates[currency]) return usdValue;
  return usdValue * rates[currency];
}

/** Format a monetary value in the given currency. */
export function fmtCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", AED: "AED ", SAR: "SAR ",
    CAD: "CA$", AUD: "A$", JPY: "¥", CHF: "CHF ", SGD: "S$",
    INR: "₹", BRL: "R$",
  };
  const sym = symbols[currency] ?? `${currency} `;
  return `${sym}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
