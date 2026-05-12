"use client";

import { cn } from "@/lib/utils";
import type { ReportMetric } from "@/types/report";

export const ALL_METRICS: { value: ReportMetric; label: string; desc: string }[] = [
  { value: "spend",       label: "Spend",       desc: "Total ad spend ($)"        },
  { value: "clicks",      label: "Clicks",       desc: "Total link clicks"         },
  { value: "impressions", label: "Impressions",  desc: "Total ad impressions"      },
  { value: "conversions", label: "Conversions",  desc: "Total conversions"         },
  { value: "revenue",     label: "Revenue",      desc: "Attributed revenue ($)"    },
  { value: "ctr",         label: "CTR",          desc: "Click-through rate (%)"    },
  { value: "cpc",         label: "CPC",          desc: "Cost per click ($)"        },
  { value: "roas",        label: "ROAS",         desc: "Return on ad spend (×)"    },
];

interface MetricSelectorProps {
  selected: ReportMetric[];
  onChange: (metrics: ReportMetric[]) => void;
  className?: string;
}

export function MetricSelector({ selected, onChange, className }: MetricSelectorProps) {
  function toggle(m: ReportMetric) {
    if (selected.includes(m)) {
      if (selected.length === 1) return; // keep at least one
      onChange(selected.filter((x) => x !== m));
    } else {
      onChange([...selected, m]);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ALL_METRICS.map(({ value, label, desc }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            title={desc}
            onClick={() => toggle(value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
