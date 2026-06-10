"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Trash2, Loader2, GitBranch,
  Users, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TeamNode from "@/components/pipeline/TeamNode";
import { usePipeline, useCreatePipeline, useUpdatePipeline, useDeletePipeline } from "@/hooks/usePipelines";
import { useTeams, type Team } from "@/hooks/useTeams";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

// ── Node types map ─────────────────────────────────────────────────────────────
const NODE_TYPES: NodeTypes = { teamNode: TeamNode };

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Convert pipeline DB format → React-Flow format
function toFlowNodes(pipelineNodes: { id: string; team_id: string; position: { x: number; y: number } }[], teams: Team[]): Node[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  return pipelineNodes.map((n, i) => {
    const team = teamMap.get(n.team_id);
    return {
      id: n.id,
      type: "teamNode",
      position: n.position,
      data: {
        teamName: team?.name ?? "Unknown Team",
        color: team?.color ?? "#6366f1",
        memberCount: team?.member_count ?? 0,
        isFirst: i === 0,
        team_id: n.team_id,
      },
    };
  });
}

function toFlowEdges(pipelineEdges: { id: string; source: string; target: string; label?: string }[]): Edge[] {
  return pipelineEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#eab308", strokeWidth: 2 },
    labelStyle: { fill: "#f9fafb", fontWeight: 600, fontSize: 11 },
    labelBgStyle: { fill: "#1f2937", stroke: "#374151" },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 6,
  }));
}

// ── Edge-label edit popover ────────────────────────────────────────────────────
function EdgeLabelPopover({
  edge,
  onSave,
  onClose,
}: {
  edge: Edge;
  onSave: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState((edge.label as string) ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-xl p-5 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Branch label</p>
          <button onClick={onClose}><X className="size-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Shown to the approver when picking a branch. E.g. "Fast Track" or "Needs QA".
        </p>
        <Input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Fast Track"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(edge.id, label); onClose(); }}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PipelineBuilderPage() {
  const params  = useParams<{ id: string }>();
  const pipelineId = params.id;
  const isNew   = pipelineId === "new";
  const router  = useRouter();

  const { hasPermission } = useAuthStore();
  const canManage = hasPermission("pipeline", "create");

  const { data: pipeline, isLoading: pipelineLoading } = usePipeline(isNew ? "" : pipelineId);
  const { data: allTeams = [], isLoading: teamsLoading } = useTeams();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline(isNew ? "" : pipelineId);
  const deletePipeline = useDeletePipeline();

  const [pipelineName, setPipelineName] = useState("New Pipeline");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const suppressDirtyRef = useRef(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<{ screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } } | null>(null);

  // Load pipeline data when editing
  useEffect(() => {
    if (!pipeline) return;
    suppressDirtyRef.current = true;
    setPipelineName(pipeline.name);
    setNodes(toFlowNodes(pipeline.nodes, allTeams));
    setEdges(toFlowEdges(pipeline.edges));
    setIsDirty(false);
    const t = setTimeout(() => { suppressDirtyRef.current = false; }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, allTeams]);

  // Track which teams are already on the canvas
  const usedTeamIds = new Set(nodes.map((n) => n.data.team_id as string));

  // ── Connect handler ──────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        id: `e-${uid()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#eab308", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(edge, eds));
      setIsDirty(true);
    },
    [setEdges]
  );

  // ── Drop team from left panel ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rfInstance || !reactFlowWrapper.current) return;

      const raw = e.dataTransfer.getData("application/reactflow-team");
      if (!raw) return;

      let teamData: Team;
      try { teamData = JSON.parse(raw); } catch { return; }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode: Node = {
        id: `n-${uid()}`,
        type: "teamNode",
        position,
        data: {
          teamName: teamData.name,
          color: teamData.color,
          memberCount: teamData.member_count,
          isFirst: nodes.length === 0,
          team_id: teamData.id,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setIsDirty(true);
    },
    [rfInstance, reactFlowWrapper, nodes.length, setNodes]
  );

  // ── Edge double-click → edit label ──────────────────────────────────────────
  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  function saveEdgeLabel(edgeId: string, label: string) {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              label: label || undefined,
              labelStyle: { fill: "#f9fafb", fontWeight: 600, fontSize: 11 },
              labelBgStyle: { fill: "#1f2937", stroke: "#374151" },
              labelBgPadding: [6, 4] as [number, number],
              labelBgBorderRadius: 6,
            }
          : e
      )
    );
    setIsDirty(true);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!pipelineName.trim()) {
      toast.error("Please enter a pipeline name");
      return;
    }

    const pipelineNodes = nodes.map((n) => ({
      id: n.id,
      team_id: n.data.team_id as string,
      position: n.position,
    }));
    const pipelineEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.label as string) ?? "",
    }));

    const payload = { name: pipelineName.trim(), nodes: pipelineNodes, edges: pipelineEdges };

    if (isNew) {
      const created = await createPipeline.mutateAsync(payload);
      setIsDirty(false);
      router.replace(`/pipeline/${created.id}`);
    } else {
      await updatePipeline.mutateAsync(payload);
      setIsDirty(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm("Delete this pipeline? Tasks already in the pipeline will not be affected.")) return;
    await deletePipeline.mutateAsync(pipelineId);
    router.push("/pipeline");
  }

  const isSaving = createPipeline.isPending || updatePipeline.isPending;

  if ((pipelineLoading || teamsLoading) && !isNew) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/50 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push("/pipeline")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>

        <div className="flex items-center gap-2 flex-1">
          <GitBranch className="size-4 text-primary shrink-0" />
          <Input
            value={pipelineName}
            onChange={(e) => { setPipelineName(e.target.value); setIsDirty(true); }}
            className="h-8 text-sm font-medium max-w-xs border-transparent focus:border-border bg-transparent"
            placeholder="Pipeline name…"
            disabled={!canManage}
          />
          {isDirty && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">unsaved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isNew && canManage && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4 mr-1.5" /> Delete
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Builder layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — available teams */}
        <div className="w-56 shrink-0 border-r bg-card/30 flex flex-col">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teams</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Drag onto canvas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {allTeams.map((team) => {
              const used = usedTeamIds.has(team.id);
              return (
                <div
                  key={team.id}
                  draggable={!used && canManage}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow-team", JSON.stringify(team));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={`
                    flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-all
                    ${used
                      ? "opacity-40 cursor-not-allowed border-dashed"
                      : canManage
                        ? "cursor-grab hover:border-primary/50 hover:bg-muted/50 active:cursor-grabbing"
                        : "cursor-default"
                    }
                  `}
                >
                  <div
                    className="size-6 rounded-md flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                    style={{ background: team.color }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-xs font-medium">{team.name}</span>
                  {used && <span className="ml-auto text-[9px] text-muted-foreground">added</span>}
                </div>
              );
            })}
            {allTeams.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Users className="size-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No teams yet</p>
              </div>
            )}
          </div>
        </div>

        {/* React Flow canvas */}
        <div className="flex-1 min-w-0" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              const userDriven = changes.some(
                (c) => c.type === "remove" || (c.type === "position" && !(c as {dragging?: boolean}).dragging)
              );
              if (userDriven && !suppressDirtyRef.current) setIsDirty(true);
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((c) => c.type === "remove") && !suppressDirtyRef.current) setIsDirty(true);
            }}
            onConnect={onConnect}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={(instance) => setRfInstance(instance as typeof rfInstance)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            className="bg-muted/10"
            nodesDraggable={canManage}
            nodesConnectable={canManage}
            elementsSelectable={canManage}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "#eab308", strokeWidth: 2, strokeDasharray: "6 3" }}
            connectionRadius={40}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => (n.data?.color as string) || "#6366f1"}
              maskColor="hsl(var(--background) / 0.7)"
              className="!border !border-border !rounded-xl overflow-hidden"
            />

            {/* Hint panel — only when canvas is empty */}
            {nodes.length === 0 && (
              <Panel position="top-center" className="pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-xl border bg-card/90 backdrop-blur px-4 py-2.5 shadow-sm text-sm text-muted-foreground mt-4"
                >
                  <Info className="size-4 text-primary shrink-0" />
                  Drag teams from the left panel · Connect them by dragging handles · Double-click a connection to add a label
                </motion.div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Edge label editor */}
      {editingEdge && (
        <EdgeLabelPopover
          edge={editingEdge}
          onSave={saveEdgeLabel}
          onClose={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}
