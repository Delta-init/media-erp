"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

// ── Platform data ─────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "google-ads",   label: "Google Ads",   initials: "GA", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { id: "ga4",          label: "GA4",           initials: "G4", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  { id: "facebook-ads", label: "Facebook Ads",  initials: "FB", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  { id: "mailchimp",    label: "Mailchimp",     initials: "MC", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  { id: "hubspot",      label: "HubSpot",       initials: "HS", color: "bg-orange-600/10 text-orange-700 dark:text-orange-400" },
  { id: "shopify",      label: "Shopify",       initials: "SH", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
] as const;

// ── Feature callouts ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "✨",
    title: "AI Analytics",
    desc: "Ask questions in plain English and get instant chart-backed answers from your marketing data.",
  },
  {
    icon: "📧",
    title: "Automated Reports",
    desc: "Schedule PDF or email reports to land in your inbox — daily, weekly, or monthly.",
  },
  {
    icon: "📊",
    title: "Live Dashboard",
    desc: "All your platforms unified in one real-time view. No more tab switching.",
  },
] as const;

// ── Slide variants ────────────────────────────────────────────────────────────
const slideVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: -60, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ── Step 1 ────────────────────────────────────────────────────────────────────
function StepWelcome({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Hero icon */}
      <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-4xl shadow-sm">
        🚀
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to mediaERP 🚀
        </h1>
        <p className="text-muted-foreground text-base max-w-sm mx-auto">
          {userName ? `Hi ${userName} — let's` : "Let's"} get you set up in 2 minutes.
        </p>
      </div>

      {/* Quick value props */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {(["Connect sources", "Ask AI anything", "Ship reports"] as const).map((label, i) => (
          <div
            key={label}
            className="rounded-xl border bg-muted/40 px-3 py-4 flex flex-col items-center gap-2"
          >
            <span className="text-xl">{["🔌", "🤖", "📤"][i]}</span>
            <p className="text-xs font-medium text-muted-foreground text-center">{label}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Get Started
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function StepConnectSource({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Connect a data source
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Pull in your marketing data from any platform. You can always add more later from
          the Connectors page.
        </p>
      </div>

      {/* Platform grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id === selected ? null : p.id)}
            className={[
              "flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all",
              "hover:border-primary/50 hover:bg-muted/40 active:scale-[0.97]",
              selected === p.id
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card",
            ].join(" ")}
          >
            <span className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${p.color}`}>
              {p.initials}
            </span>
            <span className="text-xs font-medium text-foreground leading-tight">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onNext}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Done
          <span aria-hidden>→</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          I'll do this later →
        </button>
      </div>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function StepComplete({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-green-500/10 text-4xl shadow-sm">
        🎉
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          You're all set!
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Your workspace is ready. Here's what you can do right now.
        </p>
      </div>

      {/* Feature callouts */}
      <div className="space-y-3 w-full max-w-md text-left">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-xl border bg-card p-4"
          >
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Go to Dashboard
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────
function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {([1, 2, 3] as Step[]).map((s) => (
        <div
          key={s}
          className={[
            "rounded-full transition-all duration-300",
            s === current
              ? "h-2 w-6 bg-primary"
              : s < current
              ? "size-2 bg-primary/40"
              : "size-2 bg-muted-foreground/25",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────
export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const user = useAuthStore((s) => s.user);
  const userName = user?.name ?? "";

  function next() {
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  return (
    /* Fixed full-screen backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      {/* Card */}
      <div className="relative w-full max-w-lg rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

        {/* Content area */}
        <div className="px-8 py-10 min-h-[520px] flex flex-col">
          {/* Step dots */}
          <div className="flex justify-center mb-8">
            <StepDots current={step} />
          </div>

          {/* Animated step content */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step-1" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                  <StepWelcome userName={userName} onNext={next} />
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="step-2" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                  <StepConnectSource onNext={next} />
                </motion.div>
              )}
              {step === 3 && (
                <motion.div key="step-3" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                  <StepComplete onComplete={onComplete} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer label */}
        <div className="border-t bg-muted/30 px-8 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Step {step} of 3 — mediaERP setup wizard
          </p>
        </div>
      </div>
    </div>
  );
}
