"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateStatus, useUpdateStatus } from "@/hooks/useStatuses";
import type { BoardStatus } from "@/types/project";

const PALETTE = [
  "#eab308", "#f97316", "#ef4444", "#ec4899",
  "#a855f7", "#6366f1", "#3b82f6", "#06b6d4",
  "#14b8a6", "#22c55e", "#84cc16", "#64748b",
];

interface Props {
  /** When editing, the existing status; omit to create a new column. */
  status?: BoardStatus;
  onClose: () => void;
}

export function StatusColumnModal({ status, onClose }: Props) {
  const editing = !!status;
  const [label, setLabel] = useState(status?.label ?? "");
  const [color, setColor] = useState(status?.color ?? PALETTE[5]);

  const create = useCreateStatus();
  const update = useUpdateStatus();
  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    if (editing) {
      await update.mutateAsync({ id: status!.id, payload: { label: label.trim(), color } });
    } else {
      await create.mutateAsync({ label: label.trim(), color });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Columns3 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">{editing ? "Edit Column" : "New Column"}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Live preview */}
          <div
            className="rounded-xl border px-3 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: `${color}1a`, borderColor: `${color}40` }}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
              {label.trim() || "Column name"}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Column Name *</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. In Review"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full transition-all hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim() || busy} className="flex-1">
              {busy ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              {editing ? "Save" : "Add Column"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
