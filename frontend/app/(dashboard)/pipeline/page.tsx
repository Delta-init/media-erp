"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, Trash2, Edit3, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelines, useDeletePipeline } from "@/hooks/usePipelines";
import { useAuthStore } from "@/stores/authStore";
import type { Pipeline } from "@/types/pipeline";

function PipelineCard({ pipeline, canManage, onDelete }: {
  pipeline: Pipeline;
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const nodeCount = pipeline.nodes.length;
  const edgeCount = pipeline.edges.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      {/* Gradient header */}
      <div className="h-2 bg-gradient-to-r from-primary/70 to-primary/30" />

      <div className="p-5 space-y-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <GitBranch className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{pipeline.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {nodeCount} team{nodeCount !== 1 ? "s" : ""} · {edgeCount} connection{edgeCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => router.push(`/pipeline/${pipeline.id}`)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit pipeline"
              >
                <Edit3 className="size-3.5" />
              </button>
              <button
                onClick={() => onDelete(pipeline.id)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete pipeline"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Flow preview — show first 3 nodes in order */}
        {nodeCount > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {pipeline.nodes.slice(0, 4).map((node, i) => (
              <div key={node.id} className="flex items-center gap-1">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Team
                </span>
                {i < Math.min(pipeline.nodes.length, 4) - 1 && (
                  <ArrowRight className="size-3 text-muted-foreground/50" />
                )}
              </div>
            ))}
            {nodeCount > 4 && (
              <span className="text-[10px] text-muted-foreground">+{nodeCount - 4} more</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            {new Date(pipeline.created_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => router.push(`/pipeline/${pipeline.id}`)}
          >
            {canManage ? "Edit" : "View"} flow
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function PipelineListPage() {
  const router = useRouter();
  const { data: pipelines = [], isLoading, isError } = usePipelines();
  const deletePipeline = useDeletePipeline();
  const { hasPermission } = useAuthStore();

  const canManage = hasPermission("pipeline", "create");

  function handleDelete(id: string) {
    if (!confirm("Delete this pipeline? Tasks already in the pipeline will not be affected.")) return;
    deletePipeline.mutate(id);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="size-5 text-primary" /> Pipelines
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define how tasks flow between teams when approved.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => router.push("/pipeline/new")} size="sm">
            <Plus className="size-4 mr-1.5" /> New Pipeline
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden">
              <div className="h-2 bg-muted animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="flex gap-2.5">
                  <div className="size-9 rounded-xl bg-muted animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl border bg-card">
          <AlertCircle className="size-8 text-destructive/60" />
          <p className="text-sm text-muted-foreground">Failed to load pipelines</p>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4 rounded-2xl border bg-card">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
            <GitBranch className="size-8 text-muted-foreground/50" />
          </div>
          <div className="text-center">
            <p className="font-semibold">No pipelines yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a pipeline to define how tasks flow between teams.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => router.push("/pipeline/new")} size="sm">
              <Plus className="size-4 mr-1.5" /> Create Pipeline
            </Button>
          )}
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                canManage={canManage}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
