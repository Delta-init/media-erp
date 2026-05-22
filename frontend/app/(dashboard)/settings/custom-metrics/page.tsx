"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, FlaskConical, CheckCircle2, XCircle, Loader2, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import {
  useCustomMetrics,
  useCreateCustomMetric,
  useDeleteCustomMetric,
  usePreviewFormula,
  type CustomMetric,
} from "@/hooks/useCustomMetrics";

// ── Constants ─────────────────────────────────────────────────────────────────

const METRIC_NAMES = [
  "spend", "clicks", "impressions", "conversions", "revenue",
  "ctr", "cpc", "roas",
];

const EXAMPLE_FORMULAS = [
  { label: "Cost per Conversion", formula: "spend / conversions" },
  { label: "Revenue per Click",   formula: "revenue / clicks" },
  { label: "Avg Order Value",     formula: "revenue / conversions" },
  { label: "Impression Share",    formula: "(clicks / impressions) * 100" },
  { label: "Profit (est.)",       formula: "revenue - spend" },
];

// ── Formula builder form ──────────────────────────────────────────────────────

function FormulaForm({ onDone }: { onDone: () => void }) {
  const [name,    setName]    = useState("");
  const [label,   setLabel]   = useState("");
  const [formula, setFormula] = useState("");

  const create  = useCreateCustomMetric();
  const preview = usePreviewFormula();

  const insertToken = (token: string) => {
    setFormula((prev) => prev ? `${prev} ${token}` : token);
  };

  const handlePreview = () => {
    if (!formula.trim()) return;
    preview.mutate({ formula });
  };

  const handleSave = async () => {
    if (!name || !label || !formula) return;
    await create.mutateAsync({ name, label, formula });
    onDone();
  };

  const previewData = preview.data;

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">New formula</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Metric ID (no spaces)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="cost_per_conv"
            className="w-full rounded-xl border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Display label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Cost per Conversion"
            className="w-full rounded-xl border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* Formula input */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Formula</label>
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="spend / conversions"
          className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        {/* Metric chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {METRIC_NAMES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => insertToken(m)}
              className="rounded-lg border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {m}
            </button>
          ))}
          {["+", "−", "×", "÷", "(", ")"].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insertToken(op === "−" ? "-" : op === "×" ? "*" : op === "÷" ? "/" : op)}
              className="rounded-lg border border-border px-2 py-0.5 text-xs font-mono font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {op}
            </button>
          ))}
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground self-center">Examples:</span>
          {EXAMPLE_FORMULAS.map((ex) => (
            <button
              key={ex.formula}
              type="button"
              onClick={() => { setFormula(ex.formula); setLabel(ex.label); }}
              className="rounded-lg bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview result */}
      {previewData && (
        <div className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
          previewData.valid
            ? "bg-emerald-500/10 text-emerald-700"
            : "bg-destructive/10 text-destructive"
        )}>
          {previewData.valid
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <XCircle className="size-4 shrink-0" />}
          {previewData.valid
            ? <>Result with sample data: <strong>{previewData.result?.toFixed(4)}</strong></>
            : previewData.error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreview}
          disabled={!formula || preview.isPending}
        >
          {preview.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <FlaskConical className="size-3.5 mr-1" />}
          Test
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!name || !label || !formula || create.isPending}
        >
          {create.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Plus className="size-3.5 mr-1" />}
          Save metric
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Metric row ─────────────────────────────────────────────────────────────────

function MetricRow({ metric }: { metric: CustomMetric }) {
  const del   = useDeleteCustomMetric();
  const [confirm, setConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
    >
      <Calculator className="size-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{metric.label}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{metric.formula}</p>
      </div>
      <span className="text-[11px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
        {metric.name}
      </span>
      {confirm ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => del.mutate(metric._id)}
            disabled={del.isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            {del.isPending ? "…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomMetricsPage() {
  const [creating, setCreating] = useState(false);
  const { data: metrics = [], isLoading } = useCustomMetrics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Metrics"
        subtitle="Define calculated fields using your platform data"
        action={
          !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-3.5 mr-1.5" />
              New metric
            </Button>
          )
        }
      />

      {/* Info card */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Formula syntax</p>
        <p>Use the base metrics <code className="text-xs bg-muted rounded px-1">spend clicks impressions conversions revenue ctr cpc roas</code> with standard arithmetic operators.</p>
        <p className="text-xs">Example: <code className="bg-muted rounded px-1">spend / conversions</code> → cost per conversion</p>
      </div>

      {/* Form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <FormulaForm onDone={() => setCreating(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && metrics.length === 0 && !creating && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Calculator className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No custom metrics yet.</p>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            Create your first formula
          </Button>
        </div>
      )}

      <AnimatePresence>
        <div className="space-y-2">
          {metrics.map((m) => <MetricRow key={m._id} metric={m} />)}
        </div>
      </AnimatePresence>
    </div>
  );
}
