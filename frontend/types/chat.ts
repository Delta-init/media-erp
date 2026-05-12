export interface ChatUser {
  id: string;
  name: string;
  email: string;
  designation: string;
  status: "active" | "inactive";
  online: boolean;
}

export interface ChatMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  read: boolean;
  created_at: string; // ISO 8601
}

export type WsIncoming =
  | ({ type: "message" } & ChatMessage)
  | { type: "status"; user_id: string; online: boolean }
  | { type: "online_users"; user_ids: string[] };

// ── Super Admin monitor ───────────────────────────────────────────────────────

export interface ConversationPair {
  user_a_id: string;
  user_a_name: string;
  user_b_id: string;
  user_b_name: string;
  last_message: string;
  last_sender_id: string;
  last_at: string | null;
  msg_count: number;
}
