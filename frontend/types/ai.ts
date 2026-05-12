// ── AI query types — Phase 6.4 ────────────────────────────────────────────────

export interface AiQueryResponse {
  id: string;
  question: string;
  pipeline: Record<string, unknown>[];
  result: Record<string, unknown>[];
  explanation: string;
  created_at: string;
}

export interface AiHistoryItem {
  id: string;
  question: string;
  explanation: string;
  result_count: number;
  created_at: string;
}

export interface AiHistoryData {
  items: AiHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
