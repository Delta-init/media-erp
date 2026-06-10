"""
Pipeline model — defines a team workflow graph.
MongoDB collection: 'pipelines'

A pipeline is a directed graph where:
  - nodes  → teams (entry points or processing steps)
  - edges  → "when approved in team A, advance to team B"

When a node has multiple outgoing edges, the approver picks which
branch to follow (conditional routing — human-in-the-loop decision).
"""
from typing import Optional
from pydantic import BaseModel


class NodePosition(BaseModel):
    x: float = 0.0
    y: float = 0.0


class PipelineNode(BaseModel):
    id: str                      # React-Flow node id (e.g. "n-abc123")
    team_id: str                 # MongoDB team _id
    position: NodePosition = NodePosition()


class PipelineEdge(BaseModel):
    id: str                      # React-Flow edge id (e.g. "e-abc123")
    source: str                  # source node id
    target: str                  # target node id
    label: Optional[str] = ""   # shown to approver when branching


class CreatePipelineRequest(BaseModel):
    name: str
    nodes: list[PipelineNode] = []
    edges: list[PipelineEdge] = []


class UpdatePipelineRequest(BaseModel):
    name: Optional[str] = None
    nodes: Optional[list[PipelineNode]] = None
    edges: Optional[list[PipelineEdge]] = None
