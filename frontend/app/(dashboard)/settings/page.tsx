"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, KeyRound, Loader2, Palette, QrCode, Shield, Sparkles, User } from "lucide-react";
import { useBranding, useUpdateBranding, useResetBranding } from "@/hooks/useWhitelabel";
import { useAuthStore } from "@/stores/authStore";
import { useUpdatePassword, useUpdateProfile, use2faStatus, use2faSetup, use2faEnable, use2faDisable } from "@/hooks/useAuth";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { fadeVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";

// ── Schemas ───────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  name:  z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password:     z.string().min(8, "Must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type ProfileForm   = z.infer<typeof profileSchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;
type Tab = "profile" | "password" | "plan" | "branding" | "security" | "audit";

// ── Tab button ────────────────────────────────────────────────────────────────
function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({
  label, error, children,
}: {
  label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none transition",
        "focus:border-ring focus:ring-2 focus:ring-ring/30",
        className
      )}
      {...props}
    />
  );
}

// ── Plan badge colours ────────────────────────────────────────────────────────
const PLAN_STYLES: Record<string, string> = {
  free:       "bg-muted text-muted-foreground",
  starter:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pro:        "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const PLAN_PERKS: Record<string, string[]> = {
  free:       ["5 connectors", "7-day data history", "10 AI queries/mo"],
  starter:    ["10 connectors", "30-day data history", "100 AI queries/mo"],
  pro:        ["Unlimited connectors", "1-year data history", "Unlimited AI queries"],
  enterprise: ["Everything in Pro", "SSO / SAML", "Dedicated support", "Custom SLA"],
};

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateProfile();

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "" },
  });

  // Keep form in sync if user object updates
  useEffect(() => {
    reset({ name: user?.name ?? "", email: user?.email ?? "" });
  }, [user, reset]);

  return (
    <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message}>
          <Input placeholder="Your name" {...register("name")} />
        </Field>
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" placeholder="you@example.com" {...register("email")} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
          {update.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}

// ── Password tab ──────────────────────────────────────────────────────────────
function PasswordTab() {
  const update = useUpdatePassword();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  function onSubmit(d: PasswordForm) {
    update.mutate(
      { current_password: d.current_password, new_password: d.new_password },
      { onSuccess: () => reset() }
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field label="Current password" error={errors.current_password?.message}>
        <Input type="password" placeholder="••••••••" {...register("current_password")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" error={errors.new_password?.message}>
          <Input type="password" placeholder="••••••••" {...register("new_password")} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm_password?.message}>
          <Input type="password" placeholder="••••••••" {...register("confirm_password")} />
        </Field>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        After changing your password you will need to log in again on all devices.
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}

// ── Plan tab ──────────────────────────────────────────────────────────────────
function PlanTab() {
  const user  = useAuthStore((s) => s.user);
  const plan  = user?.plan ?? "free";
  const perks = PLAN_PERKS[plan] ?? PLAN_PERKS.free;

  return (
    <div className="space-y-5">
      {/* Current plan card */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current plan
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold capitalize text-foreground">{plan}</p>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                PLAN_STYLES[plan] ?? PLAN_STYLES.free
              )}>
                Active
              </span>
            </div>
          </div>
          <Sparkles className="size-8 text-primary/40" />
        </div>

        <ul className="space-y-1.5">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              {perk}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade CTA for non-enterprise */}
      {plan !== "enterprise" && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">
            Need more power?
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Upgrade to unlock unlimited connectors, longer data history, and more AI queries.
            Contact your account manager or visit the billing portal.
          </p>
          <Button size="sm" variant="outline" disabled>
            Upgrade plan
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
// ── Branding panel ────────────────────────────────────────────────────────────
function BrandingPanel() {
  const { data: branding } = useBranding();
  const updateBranding = useUpdateBranding();
  const resetBranding  = useResetBranding();

  const [form, setForm] = useState({
    company_name:           "",
    logo_url:               "",
    primary_color:          "#18181b",
    accent_color:           "#facc15",
    footer_text:            "",
    report_title_prefix:    "",
    hide_mediaerp_branding: false,
  });

  // Sync form from server data
  const [synced, setSynced] = useState(false);
  if (branding && !synced) {
    setForm({
      company_name:           branding.company_name ?? "",
      logo_url:               branding.logo_url ?? "",
      primary_color:          branding.primary_color ?? "#18181b",
      accent_color:           branding.accent_color ?? "#facc15",
      footer_text:            branding.footer_text ?? "",
      report_title_prefix:    branding.report_title_prefix ?? "",
      hide_mediaerp_branding: branding.hide_mediaerp_branding ?? false,
    });
    setSynced(true);
  }

  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";
  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-medium text-sm">White-label Branding</h3>
        <p className="text-xs text-muted-foreground">
          Customise the branding applied to your PDF/Excel exports and email reports. Requires an Enterprise plan for full white-labelling.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Company Name</label>
            <input className={inputCls} placeholder="Your Company" value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Logo URL</label>
            <input className={inputCls} placeholder="https://yourco.com/logo.png" value={form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Primary Color</label>
            <div className="flex gap-2">
              <input type="color" className="h-9 w-9 rounded border p-0.5 cursor-pointer" value={form.primary_color}
                onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
              <input className={cn(inputCls, "flex-1")} value={form.primary_color}
                onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Accent Color</label>
            <div className="flex gap-2">
              <input type="color" className="h-9 w-9 rounded border p-0.5 cursor-pointer" value={form.accent_color}
                onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} />
              <input className={cn(inputCls, "flex-1")} value={form.accent_color}
                onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} />
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Report Footer Text</label>
            <input className={inputCls} placeholder="Generated by Your Company" value={form.footer_text}
              onChange={(e) => setForm((f) => ({ ...f, footer_text: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Report Title Prefix</label>
            <input className={inputCls} placeholder="e.g. 'Confidential —'" value={form.report_title_prefix}
              onChange={(e) => setForm((f) => ({ ...f, report_title_prefix: e.target.value }))} />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={cn("relative h-5 w-9 rounded-full transition-colors", form.hide_mediaerp_branding ? "bg-primary" : "bg-muted-foreground/30")}
            onClick={() => setForm((f) => ({ ...f, hide_mediaerp_branding: !f.hide_mediaerp_branding }))}
          >
            <div className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", form.hide_mediaerp_branding ? "translate-x-4" : "translate-x-0.5")} />
          </div>
          <span className="text-sm">Hide "Powered by mediaERP" in exports</span>
        </label>

        {/* Preview */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">PDF Header Preview</p>
          <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: form.primary_color }}>
            <div className="font-bold text-white text-sm">{form.company_name || "Your Company"}</div>
            <div className="text-white/60 text-xs ml-auto">Campaign Performance Report</div>
          </div>
          <div className="mt-1 rounded-b-lg bg-muted/50 px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">{form.footer_text || `Generated by ${form.company_name || "Your Company"}`}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => updateBranding.mutate(form)} disabled={updateBranding.isPending}>
            {updateBranding.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save Branding
          </Button>
          <Button size="sm" variant="outline" onClick={() => { resetBranding.mutate(); setSynced(false); }} disabled={resetBranding.isPending}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Security / 2FA tab ────────────────────────────────────────────────────────
function SecurityTab() {
  const { data: status } = use2faStatus();
  const setup = use2faSetup();
  const enable = use2faEnable();
  const disable = use2faDisable();
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");

  const isEnabled = status?.two_fa_enabled ?? false;

  function handleSetup() {
    setup.mutate(undefined, { onSuccess: (d) => setSetupData(d) });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-foreground">Authenticator App (TOTP)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use Google Authenticator, Authy, or 1Password to generate login codes.
            </p>
          </div>
          <span className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            isEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
          )}>
            {isEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {!isEnabled && !setupData && (
          <Button size="sm" onClick={handleSetup} disabled={setup.isPending}>
            {setup.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            Set up 2FA
          </Button>
        )}

        {setupData && !isEnabled && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 border p-4 space-y-3">
              <p className="text-xs font-medium text-foreground">1. Scan this QR code with your authenticator app:</p>
              <div className="flex items-center justify-center">
                <div className="rounded-lg border bg-white p-3">
                  <QrCode className="size-24 text-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Or enter this secret manually:</p>
              <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono text-center break-all">
                {setupData.secret}
              </code>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">2. Enter the 6-digit code from your app:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  className="w-36 font-mono text-center tracking-widest"
                />
                <Button
                  size="sm"
                  onClick={() => enable.mutate(code, { onSuccess: () => { setSetupData(null); setCode(""); } })}
                  disabled={code.length !== 6 || enable.isPending}
                >
                  {enable.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                  Verify & Enable
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEnabled && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Enter your current authenticator code to disable 2FA:</p>
            <div className="flex gap-2">
              <Input
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="w-36 font-mono text-center tracking-widest"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => disable.mutate(code, { onSuccess: () => setCode("") })}
                disabled={code.length !== 6 || disable.isPending}
              >
                {disable.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-muted/30 border-dashed p-4 text-xs text-muted-foreground">
        <Shield className="size-4 mb-1.5 text-primary/60" />
        When 2FA is enabled, you&apos;ll need your authenticator app in addition to your password when logging in.
      </div>
    </div>
  );
}

// ── Audit Logs tab ────────────────────────────────────────────────────────────
function AuditTab() {
  const { data, isLoading } = useAuditLogs({ limit: 50 });
  const logs = data?.logs ?? [];

  const ACTION_COLORS: Record<string, string> = {
    login:             "bg-blue-500/10 text-blue-600",
    "connector.create": "bg-emerald-500/10 text-emerald-600",
    "connector.delete": "bg-red-500/10 text-red-600",
    "profile.update":  "bg-amber-500/10 text-amber-600",
  };

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short", timeStyle: "short",
    });
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (!logs.length) return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <ClipboardList className="size-8 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">No audit events yet</p>
      <p className="text-xs text-muted-foreground mt-1">Events are recorded as you use the platform.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Showing the last {logs.length} events for your account.</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Resource</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"
                  )}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.resource_type}{log.resource_id ? ` · ${log.resource_id}` : ""}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{fmt(log.created_at)}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{log.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",  label: "Profile",  icon: User },
  { id: "password", label: "Password", icon: KeyRound },
  { id: "plan",     label: "Plan",     icon: Shield },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "security", label: "Security", icon: Shield },
  { id: "audit",    label: "Audit Logs", icon: ClipboardList },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, security, and subscription"
      />

      {/* Tab bar */}
      <div className="rounded-xl border bg-muted/40 p-1 w-fit flex gap-0.5">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </div>

      {/* Tab panels */}
      <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {tab === "profile"  && <ProfileTab />}
            {tab === "password" && <PasswordTab />}
            {tab === "plan"     && <PlanTab />}
            {tab === "branding" && <BrandingPanel />}
            {tab === "security" && <SecurityTab />}
            {tab === "audit"    && <AuditTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
