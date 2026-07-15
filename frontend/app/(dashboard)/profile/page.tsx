"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail, Briefcase, ShieldCheck, Calendar, Loader2,
  User as UserIcon, KeyRound, LogOut, BadgeCheck, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useMe, useUpdateProfile, useUpdatePassword, useLogout } from "@/hooks/useAuth";
import { useNotificationPrefs, useUpdateNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { NOTIF_DEFS, ROLE_LABEL, getNotifCategory } from "@/lib/notifications";

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email"),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "Must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialsOf(name?: string, email?: string) {
  if (name) return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return email?.[0]?.toUpperCase() ?? "U";
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-muted/20 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, desc, disabled,
}: { checked: boolean; onChange: () => void; label: string; desc?: string; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", disabled && "opacity-50")}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ── Email notifications card ──────────────────────────────────────────────────

function EmailNotificationsCard() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  const [enabled, setEnabled] = useState(true);
  const [types, setTypes] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setEnabled(data.email_enabled ?? true);
      setTypes(data.email_types ?? {});
      setDirty(false);
    }
  }, [data]);

  const category = getNotifCategory(user);
  const defs = NOTIF_DEFS[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="mb-1 flex items-center gap-2">
        <Bell className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Email Notifications</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Choose which updates land in your inbox ({ROLE_LABEL[category]}).
      </p>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground/50" /></div>
      ) : (
        <div className="divide-y">
          <Toggle
            checked={enabled}
            onChange={() => { setEnabled((v) => !v); setDirty(true); }}
            label="Email notifications"
            desc="Master switch — turn all email updates on or off"
          />
          {defs.map((d) => (
            <Toggle
              key={d.key}
              checked={enabled ? (types[d.key] ?? true) : false}
              disabled={!enabled}
              onChange={() => { setTypes((p) => ({ ...p, [d.key]: !(p[d.key] ?? true) })); setDirty(true); }}
              label={d.label}
              desc={d.desc}
            />
          ))}
        </div>
      )}

      <p className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Always sent (can’t be turned off): password resets, account invitations, and system/security emails.
      </p>

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => update.mutate({ email_enabled: enabled, email_types: types }, { onSuccess: () => setDirty(false) })}
          disabled={!dirty || update.isPending}
        >
          {update.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const storeUser = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const user = me ?? storeUser;

  const updateProfile = useUpdateProfile();
  const updatePassword = useUpdatePassword();
  const logout = useLogout();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", email: user?.email ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  function onSaveProfile(v: ProfileForm) {
    updateProfile.mutate(v);
  }

  function onChangePassword(v: PasswordForm) {
    updatePassword.mutate(
      { current_password: v.current_password, new_password: v.new_password },
      { onSuccess: () => passwordForm.reset() }
    );
  }

  const roleName = user?.role?.role_name ?? "User";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      >
        <div className="h-24 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex flex-wrap items-end gap-4">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg ring-4 ring-card">
              {initialsOf(user?.name, user?.email)}
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold">{user?.name || "—"}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                {roleName}
              </p>
            </div>
            <div className="ml-auto pb-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  user?.status === "inactive"
                    ? "bg-muted text-muted-foreground"
                    : "bg-green-500/15 text-green-600 dark:text-green-400"
                }`}
              >
                <BadgeCheck className="size-3.5" />
                {user?.status === "inactive" ? "Inactive" : "Active"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field icon={<Mail className="size-4" />} label="Email" value={user?.email} />
            <Field icon={<Briefcase className="size-4" />} label="Designation" value={user?.designation || "—"} />
            <Field icon={<ShieldCheck className="size-4" />} label="Role" value={roleName} />
            <Field icon={<Calendar className="size-4" />} label="Member since" value={memberSince} />
          </div>
        </div>
      </motion.div>

      {/* Edit profile */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onSubmit={profileForm.handleSubmit(onSaveProfile)}
        className="rounded-2xl border bg-card p-6 shadow-sm"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="size-4 text-muted-foreground" /> Edit Profile
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full name</label>
            <Input {...profileForm.register("name")} placeholder="Your name" />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" {...profileForm.register("email")} placeholder="you@company.com" />
            {profileForm.formState.errors.email && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={updateProfile.isPending || !profileForm.formState.isDirty}>
            {updateProfile.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </motion.form>

      {/* Change password */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={passwordForm.handleSubmit(onChangePassword)}
        className="rounded-2xl border bg-card p-6 shadow-sm"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-muted-foreground" /> Change Password
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Current</label>
            <Input type="password" {...passwordForm.register("current_password")} placeholder="••••••••" />
            {passwordForm.formState.errors.current_password && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.current_password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">New</label>
            <Input type="password" {...passwordForm.register("new_password")} placeholder="At least 8 characters" />
            {passwordForm.formState.errors.new_password && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.new_password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Confirm</label>
            <Input type="password" {...passwordForm.register("confirm_password")} placeholder="Repeat new password" />
            {passwordForm.formState.errors.confirm_password && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="outline" disabled={updatePassword.isPending}>
            {updatePassword.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </motion.form>

      {/* Email notifications */}
      <EmailNotificationsCard />

      {/* Sign out */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={() => logout.mutate()}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-1.5 size-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
