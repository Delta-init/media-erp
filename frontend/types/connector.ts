export type ConnectorPlatform =
  | "google_ads"
  | "ga4"
  | "facebook_ads"
  | "facebook_pages"
  | "instagram"
  | "instagram_login"
  | "linkedin_ads"
  | "tiktok_ads";

export type SyncFrequency = "hourly" | "daily" | "manual";

export type ConnectorStatus = "disconnected" | "connected" | "syncing" | "error";

export interface Connector {
  id: string;
  platform: ConnectorPlatform;
  name: string;
  status: ConnectorStatus;
  sync_frequency: SyncFrequency;
  platform_account_id: string | null;
  last_synced_at: string | null;
  token_expires_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectorPayload {
  platform: ConnectorPlatform;
  name: string;
  sync_frequency?: SyncFrequency;
}

export interface UpdateConnectorPayload {
  name?: string;
  sync_frequency?: SyncFrequency;
}
