"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  className?: string;
}

export function Pagination({ page, pages, total, limit, onPage, className }: PaginationProps) {
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build page list with ellipsis
  function pageList(): (number | "…")[] {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const list: (number | "…")[] = [1];
    if (page > 3) list.push("…");
    for (let p = Math.max(2, page - 1); p <= Math.min(pages - 1, page + 1); p++) list.push(p);
    if (page < pages - 2) list.push("…");
    list.push(pages);
    return list;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4 text-sm", className)}>
      <p className="text-muted-foreground text-xs">
        {from}–{to} of {total} rows
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex size-7 items-center justify-center rounded-lg border bg-background hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {pageList().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-background hover:bg-muted"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="flex size-7 items-center justify-center rounded-lg border bg-background hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
