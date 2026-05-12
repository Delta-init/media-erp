"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Loader2, Shield, Sparkles, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUpdatePassword, useUpdateProfile } from "@/hooks/useAuth";
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
type Tab = "profile" | "password" | "plan";

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
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",  label: "Profile",  icon: User },
  { id: "password", label: "Password", icon: KeyRound },
  { id: "plan",     label: "Plan",     icon: Shield },
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
