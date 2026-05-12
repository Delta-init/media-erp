export type NotificationType = "sync_success" | "sync_error" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationsData {
  items: Notification[];
  unread_count: number;
}
