export interface PipelineNodePosition {
  x: number;
  y: number;
}

export interface PipelineNode {
  id: string;        // React-Flow node id
  team_id: string;
  position: PipelineNodePosition;
}

export interface PipelineEdge {
  id: string;        // React-Flow edge id
  source: string;    // source node id
  target: string;    // target node id
  label?: string;    // shown when multiple outgoing edges (conditional branch label)
}

export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Branch option returned when an approved task has multiple outgoing edges. */
export interface PipelineBranchOption {
  edge_id: string;
  target_node_id: string;
  target_team_id: string;
  target_team_name: string;
  edge_label: string;
}
