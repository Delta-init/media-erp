"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SyncStatusBadge } from "@/components/shared/SyncStatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SyncHistoryPanel } from "@/components/connectors/SyncHistoryPanel";
import { useDeleteConnector, useStartOAuth } from "@/hooks/useConnectors";
import { useTriggerSync, useSyncStatus } from "@/hooks/useSync";
import { PLATFORM_META } from "@/lib/platformMeta";
import type { Connector } from "@/types/connector";

interface Props {
  connector: Connector;
}

export function ConnectorCard({ connector }: Props) {
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [historyOpen,  setHistoryOpen]  = useState(false);

  const meta       = PLATFORM_META[connector.platform];
  const deleteMut  = useDeleteConnector();
  const oauthMut   = useStartOAuth();
  const syncMut    = useTriggerSync();

  const isAuthenticated = connector.status !== "disconnected";

  // Poll sync status while this connector is actively syncing
  const { data: syncStatusData } = useSyncStatus(
    connector.id,
    connector.status === "syncing"
  );

  // Derive live status: prefer polled data while syncing, fall back to connector prop
  const liveStatus =
    connector.status === "syncing"
      ? (syncStatusData?.connector?.status ?? connector.status)
      : connector.status;

  const liveLastSync =
    syncStatusData?.connector?.last_synced_at ?? connector.last_synced_at;

  const isSyncing   = liveStatus === "syncing";
  const isConnected = liveStatus === "connected";

  return (
    <>
      <motion.div
        whileHover={{ y: -3, boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.15)" }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 3 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white",
              meta.bgClass
            )}
          >
            {meta.initials}
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">{connector.name}</p>
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>

          <SyncStatusBadge status={liveStatus as Connector["status"]} />
        </div>

        {/* Meta */}
        <div className="text-xs text-muted-foreground">
          Sync:{" "}
          <span className="capitalize">{connector.sync_frequency}</span>
          {liveLastSync && (
            <span className="ml-3">
              Last:{" "}
              {new Date(liveLastSync).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {connector.error_message && liveStatus === "error" && (
            <p className="mt-1 truncate text-destructive" title={connector.error_message}>
              {connector.error_message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {/* Connect / Reconnect */}
          {(liveStatus === "disconnected" || liveStatus === "error") && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="sm"
                onClick={() =>
                  oauthMut.mutate({
                    platform: connector.platform,
                    connectorId: connector.id,
                  })
                }
                disabled={oauthMut.isPending}
              >
                {oauthMut.isPending ? "Redirecting…" : "Connect"}
              </Button>
            </motion.div>
          )}

          {/* Sync Now — only when connected and idle */}
          {isConnected && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => syncMut.mutate(connector.id)}
                disabled={syncMut.isPending || isSyncing}
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 size-3",
                    (syncMut.isPending || isSyncing) && "animate-spin"
                  )}
                />
                {isSyncing ? "Syncing…" : "Sync now"}
              </Button>
            </motion.div>
          )}

          {/* Syncing spinner (when status arrives as syncing) */}
          {isSyncing && !isConnected && (
            <Button size="sm" variant="secondary" disabled>
              <RefreshCw className="mr-1.5 size-3 animate-spin" />
              Syncing…
            </Button>
          )}

          {/* History — always visible for authenticated connectors */}
          {isAuthenticated && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="mr-1.5 size-3" />
                History
              </Button>
            </motion.div>
          )}

          {/* Remove */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="ml-auto"
          >
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              Remove
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove connector"
        description={`Remove "${connector.name}"? This cannot be undone and will delete all stored credentials.`}
        confirmLabel="Remove"
        loading={deleteMut.isPending}
        onConfirm={() =>
          deleteMut.mutate(connector.id, {
            onSuccess: () => setConfirmOpen(false),
          })
        }
      />

      {/* Sync history */}
      <SyncHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        connectorId={connector.id}
        connectorName={connector.name}
      />
    </>
  );
}
