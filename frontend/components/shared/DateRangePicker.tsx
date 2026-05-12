"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
}

// Quick-select presets
const PRESETS = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  const today = useMemo(() => toDateStr(new Date()), []);

  function applyPreset(days: number) {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    onFromChange(toDateStr(start));
    onToChange(toDateStr(end));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Preset buttons */}
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p.days)}
          className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {p.label}
        </button>
      ))}

      <span className="hidden text-xs text-muted-foreground sm:inline">|</span>

      {/* From date */}
      <input
        type="date"
        value={dateFrom}
        max={dateTo || today}
        onChange={(e) => onFromChange(e.target.value)}
        className={cn(
          "h-8 rounded-lg border bg-background px-2 text-xs outline-none",
          "focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
          "text-foreground"
        )}
      />

      <span className="text-xs text-muted-foreground">→</span>

      {/* To date */}
      <input
        type="date"
        value={dateTo}
        min={dateFrom}
        max={today}
        onChange={(e) => onToChange(e.target.value)}
        className={cn(
          "h-8 rounded-lg border bg-background px-2 text-xs outline-none",
          "focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
          "text-foreground"
        )}
      />
    </div>
  );
}
