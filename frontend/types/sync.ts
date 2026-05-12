export type SyncRunStatus = "running" | "success" | "error";

export interface SyncRun {
  id: string;
  connector_id: string;
  connector_name: string;
  platform: string;
  status: SyncRunStatus;
  started_at: string;
  finished_at: string | null;
  records_synced: number;
  error: string | null;
}

export interface SyncStatusData {
  connector: {
    id: string;
    name: string;
    platform: string;
    status: string;
    sync_frequency: string;
    last_synced_at: string | null;
    error_message: string | null;
    platform_account_id: string | null;
  };
  latest_run: SyncRun | null;
}

export interface SyncHistoryData {
  runs: SyncRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface TriggerSyncData {
  task_id: string;
  connector_id: string;
  platform: string;
  status: "queued";
}
