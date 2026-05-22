"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Power,
  Shield,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useToggleApiKey,
} from "@/hooks/useApiKeys";
import type { ApiKey, CreateApiKeyResult } from "@/hooks/useApiKeys";
import { listVariants, listItemVariants, fadeVariants } from "@/lib/animations";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

const SCOPE_COLORS: Record<string, string> = {
  read:  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  write: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  admin: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const SCOPE_ICONS: Record<string, React.ElementType> = {
  read:  Eye,
  write: Zap,
  admin: Shield,
};

// ── New key revealed banner ───────────────────────────────────────────────────

function NewKeyBanner({ result, onDismiss }: { result: CreateApiKeyResult; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* fallback */}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Copy your new API key now
            </p>
            <p className="mt-0.5 text-sm text-amber-700/80 dark:text-amber-400/70">
              It will not be shown again once you dismiss this banner.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-amber-600 hover:bg-amber-200/60 dark:text-amber-400 dark:hover:bg-amber-900/30"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 rounded-xl border border-amber-200 bg-white/60 px-3 py-2 font-mono text-sm dark:border-amber-900/40 dark:bg-black/20">
          {visible ? result.key : result.key.replace(/./g, "•")}
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          className="rounded-xl border border-amber-200 bg-white/60 p-2 text-amber-600 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-black/20 dark:text-amber-400 dark:hover:bg-amber-900/20"
          title={visible ? "Hide key" : "Show key"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="gap-2 border-amber-300 bg-white/60 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-black/20 dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy key"}
        </Button>
      </div>

      <div className="mt-3 rounded-lg bg-amber-100/60 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700/80 dark:text-amber-400/70">
        <strong>Usage:</strong>{" "}
        <code className="rounded bg-amber-200/60 dark:bg-amber-900/40 px-1">
          Authorization: ApiKey {result.key_prefix}
        </code>
      </div>
    </motion.div>
  );
}

// ── Create key dialog ─────────────────────────────────────────────────────────

const SCOPES = [
  { id: "read",  label: "Read",  desc: "GET endpoints only" },
  { id: "write", label: "Write", desc: "GET + POST/PUT/PATCH" },
  { id: "admin", label: "Admin", desc: "Full access (all endpoints)" },
];

const EXPIRY_OPTIONS = [
  { label: "No expiry",  value: null },
  { label: "30 days",   value: 30 },
  { label: "90 days",   value: 90 },
  { label: "1 year",    value: 365 },
];

function CreateKeyModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (result: CreateApiKeyResult) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiry, setExpiry] = useState<number | null>(null);
  const createKey = useCreateApiKey();

  const toggleScope = (s: string) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await createKey.mutateAsync({
      name: name.trim(),
      scopes,
      expires_days: expiry,
    });
    onCreate(result);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create API Key</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Key name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zapier integration"
              maxLength={100}
              required
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Scopes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Permissions</label>
            <div className="space-y-2">
              {SCOPES.map(({ id, label, desc }) => {
                const active = scopes.includes(id);
                const Icon = SCOPE_ICONS[id] ?? Eye;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleScope(id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      SCOPE_COLORS[id] ?? "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="size-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <div className={cn(
                      "size-4 rounded-full border-2 transition-all",
                      active ? "border-primary bg-primary" : "border-border"
                    )}>
                      {active && <Check className="size-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Expiration</label>
            <div className="flex gap-2 flex-wrap">
              {EXPIRY_OPTIONS.map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setExpiry(value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-all",
                    expiry === value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || scopes.length === 0 || createKey.isPending} className="gap-2">
              {createKey.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Key className="size-4" />
              )}
              Create key
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Key row ───────────────────────────────────────────────────────────────────

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const revoke = useRevokeApiKey();
  const toggle = useToggleApiKey();
  const [confirming, setConfirming] = useState(false);

  return (
    <motion.div
      variants={listItemVariants}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 transition-opacity",
        !apiKey.is_active && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            apiKey.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Key className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{apiKey.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{apiKey.key_prefix}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggle.mutate(apiKey.id)}
            disabled={toggle.isPending}
            title={apiKey.is_active ? "Disable key" : "Enable key"}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <Power className={cn("size-4", apiKey.is_active && "text-emerald-500")} />
          </button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => revoke.mutate(apiKey.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              title="Revoke key"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5">
        {apiKey.scopes.map((s) => {
          const Icon = SCOPE_ICONS[s] ?? Eye;
          return (
            <span key={s} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize", SCOPE_COLORS[s] ?? "bg-muted text-muted-foreground")}>
              <Icon className="size-3" />
              {s}
            </span>
          );
        })}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Created {fmtDate(apiKey.created_at)}</span>
        {apiKey.last_used_at && (
          <span>Last used {fmtRelative(apiKey.last_used_at)}</span>
        )}
        {apiKey.expires_at && (
          <span className={cn(
            new Date(apiKey.expires_at) < new Date() ? "text-destructive" : ""
          )}>
            Expires {fmtDate(apiKey.expires_at)}
          </span>
        )}
        {!apiKey.expires_at && (
          <span>No expiry</span>
        )}
        {!apiKey.is_active && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Disabled</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys();
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<CreateApiKeyResult | null>(null);

  const handleCreate = (result: CreateApiKeyResult) => {
    setShowModal(false);
    setNewKey(result);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="API Keys"
        subtitle="Create keys to access mediaERP programmatically from your own tools"
        action={
          <Button onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="size-4" />
            New key
          </Button>
        }
      />

      {/* Usage guide */}
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm">
        <p className="font-medium mb-2">How to use API keys</p>
        <p className="text-muted-foreground mb-3">
          Include your key in the <code className="rounded bg-muted px-1">Authorization</code> header of every request:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-background border px-4 py-3 text-xs font-mono">
{`GET /api/v1/reports/overview
Authorization: ApiKey merp_your_key_here`}
        </pre>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { scope: "read",  desc: "Analytics, reports, campaign data" },
            { scope: "write", desc: "Campaign edits, scheduling, rules" },
            { scope: "admin", desc: "Full access including user management" },
          ].map(({ scope, desc }) => {
            const Icon = SCOPE_ICONS[scope] ?? Eye;
            return (
              <div key={scope} className={cn("flex items-start gap-2 rounded-xl p-3", SCOPE_COLORS[scope] ?? "bg-muted")}>
                <Icon className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold capitalize">{scope}</p>
                  <p className="text-[11px] opacity-80">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New key banner */}
      <AnimatePresence>
        {newKey && (
          <NewKeyBanner result={newKey} onDismiss={() => setNewKey(null)} />
        )}
      </AnimatePresence>

      {/* Key list */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          Loading API keys…
        </div>
      ) : !keys?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <Key className="size-8 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No API keys yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create your first key to get programmatic access
            </p>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="size-4" />
            Create key
          </Button>
        </div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {keys.map((k) => (
            <ApiKeyRow key={k.id} apiKey={k} />
          ))}
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <CreateKeyModal
            onClose={() => setShowModal(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
