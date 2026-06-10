"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Crown, Users } from "lucide-react";

export interface TeamNodeData extends Record<string, unknown> {
  teamName: string;
  color: string;
  memberCount: number;
  isFirst?: boolean;
  team_id?: string;
}

function TeamNode({ data, selected, isConnectable }: NodeProps<TeamNodeData>) {
  return (
    <div
      style={{ width: 200 }}
      className={`
        relative rounded-xl border-2 bg-card shadow-md
        transition-all duration-150
        ${selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-border/80 hover:shadow-lg"}
      `}
    >
      {/* Colour bar */}
      <div className="h-1.5 rounded-t-[10px]" style={{ background: data.color }} />

      <div className="px-4 py-3 space-y-2">
        {/* Team initial + name */}
        <div className="flex items-center gap-2.5">
          <div
            className="size-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: data.color }}
          >
            {data.teamName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{data.teamName}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Users className="size-2.5" />
              {data.memberCount} member{data.memberCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Entry badge */}
        {data.isFirst && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Crown className="size-3" /> Entry point
          </div>
        )}
      </div>

      {/* ── Handles ── */}
      {/* Target: top — receives connections from other teams */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{
          width: 16,
          height: 16,
          background: "#6b7280",
          border: "3px solid #1f2937",
          borderRadius: "50%",
          zIndex: 10,
        }}
      />
      {/* Source: bottom — sends connections to other teams */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{
          width: 16,
          height: 16,
          background: "#eab308",
          border: "3px solid #1f2937",
          borderRadius: "50%",
          zIndex: 10,
        }}
      />
    </div>
  );
}

export default memo(TeamNode);
