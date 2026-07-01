"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  RotateCcw,
} from "lucide-react";
import { useForgotPassword, useResetPassword } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

// ── Schemas ───────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const otpSchema = z
  .object({
    otp: z
      .string()
      .length(6, "Enter the 6-digit code")
      .regex(/^\d{6}$/, "Only digits are allowed"),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type EmailData = z.infer<typeof emailSchema>;
type OtpData   = z.infer<typeof otpSchema>;
type Step      = "email" | "otp" | "success";

// ── Shared delta-card wrapper ─────────────────────────────────────────────────

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div
        className="delta-card delta-slide-up"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* Blue top accent */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, #0057b8, #00b4d8)",
            borderRadius: "20px 20px 0 0",
          }}
        />
        <div style={{ padding: "44px 38px 36px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step,  setStep]  = useState<Step>("email");
  const [email, setEmail] = useState("");

  const forgotPassword = useForgotPassword();
  const resetPassword  = useResetPassword();

  const emailForm = useForm<EmailData>({ resolver: zodResolver(emailSchema) });
  const otpForm   = useForm<OtpData>({ resolver: zodResolver(otpSchema) });

  function onEmailSubmit(data: EmailData) {
    forgotPassword.mutate({ email: data.email }, {
      onSuccess: () => {
        setEmail(data.email);
        setStep("otp");
      },
    });
  }

  function onOtpSubmit(data: OtpData) {
    resetPassword.mutate(
      { email, otp: data.otp, new_password: data.new_password },
      { onSuccess: () => setStep("success") }
    );
  }

  // ── Step 3: success ──────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <AuthCard>
        <div className="flex flex-col gap-6">
          <FieldGroup>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="size-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold" style={{ color: "hsl(222 47% 11%)" }}>
                  Password reset!
                </h1>
                <p className="mt-1 text-sm text-muted-foreground text-balance">
                  Your password has been updated successfully.
                </p>
              </div>
            </div>
            <Field>
              <Button type="button" onClick={() => router.push("/login")}>
                Sign in with new password
              </Button>
            </Field>
          </FieldGroup>
        </div>
      </AuthCard>
    );
  }

  // ── Step 2: OTP + new password ───────────────────────────────────────────────
  if (step === "otp") {
    return (
      <AuthCard>
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="flex flex-col gap-6">
          <FieldGroup>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="size-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold" style={{ color: "hsl(222 47% 11%)" }}>
                  Enter your code
                </h1>
                <p className="mt-1 text-sm text-muted-foreground text-balance">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p>• Code expires in <strong>10 minutes</strong></p>
              <p>• Check your spam folder if you don&apos;t see it</p>
            </div>

            <Field>
              <FieldLabel htmlFor="otp">6-digit code</FieldLabel>
              <Input
                id="otp" type="text" inputMode="numeric" maxLength={6}
                placeholder="123456" autoComplete="one-time-code"
                className="text-center tracking-[0.4em] text-lg font-mono"
                {...otpForm.register("otp")}
              />
              <FieldError errors={[otpForm.formState.errors.otp]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="new_password">New password</FieldLabel>
              <Input
                id="new_password" type="password" autoComplete="new-password"
                placeholder="Min. 8 characters" {...otpForm.register("new_password")}
              />
              <FieldError errors={[otpForm.formState.errors.new_password]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm_password">Confirm new password</FieldLabel>
              <Input
                id="confirm_password" type="password" autoComplete="new-password"
                placeholder="Repeat your password" {...otpForm.register("confirm_password")}
              />
              <FieldError errors={[otpForm.formState.errors.confirm_password]} />
            </Field>

            <Field>
              <Button type="submit" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting…" : "Reset password"}
              </Button>
            </Field>

            <FieldDescription className="text-center space-y-1">
              <span className="block">
                Didn&apos;t receive the code?{" "}
                <button
                  type="button"
                  disabled={forgotPassword.isPending}
                  onClick={() => forgotPassword.mutate({ email }, { onSuccess: () => otpForm.reset() })}
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="size-3" />
                  Resend code
                </button>
              </span>
              <span className="block">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  Use a different email
                </button>
              </span>
            </FieldDescription>
          </FieldGroup>
        </form>
      </AuthCard>
    );
  }

  // ── Step 1: email form ───────────────────────────────────────────────────────
  return (
    <AuthCard>
      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="flex flex-col gap-6">
        <FieldGroup>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "hsl(222 47% 11%)" }}>
                Forgot password?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground text-balance">
                Enter your email and we&apos;ll send you a reset code
              </p>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email" type="email" autoComplete="email"
              placeholder="you@company.com" {...emailForm.register("email")}
            />
            <FieldError errors={[emailForm.formState.errors.email]} />
          </Field>

          <Field>
            <Button type="submit" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? "Sending…" : "Send reset code"}
            </Button>
          </Field>

          <FieldDescription className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
