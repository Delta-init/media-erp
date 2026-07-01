"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle, UserRound, Mail, Lock } from "lucide-react";
import { useRegister } from "@/hooks/useAuth";

const schema = z.object({
  name:     z.string().min(1, "Full name is required"),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;

const BLUE = "#0057b8";

function IconInput({
  id, type, autoComplete, placeholder, icon: Icon, focused, onFocus, onBlur,
  hasError, registration, rightSlot,
}: {
  id: string; type: string; autoComplete?: string; placeholder?: string;
  icon: React.ElementType; focused: boolean; onFocus: () => void; onBlur: () => void;
  hasError: boolean; registration: object; rightSlot?: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`delta-input delta-input-icon${hasError ? " error" : ""}`}
        style={rightSlot ? { paddingRight: 44 } : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        {...registration}
      />
      <Icon
        style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          width: 15, height: 15, pointerEvents: "none",
          color: focused ? BLUE : "hsl(215 16% 65%)",
          transition: "color 0.2s ease",
        }}
      />
      {rightSlot}
    </div>
  );
}

export default function RegisterPage() {
  const register_ = useRegister();

  const [showPwd, setShowPwd] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <motion.div
      className="delta-slide-up"
      style={{ width: "100%", maxWidth: 420 }}
    >
      {/* ── Delta white card ── */}
      <div
        className="delta-card"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* Blue top accent */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${BLUE}, #00b4d8)`,
            borderRadius: "20px 20px 0 0",
          }}
        />
        {/* Top-right glow */}
        <div
          style={{
            position: "absolute", top: -60, right: -60,
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,87,184,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ padding: "44px 38px 36px" }}>

          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <Image
              src="/logo-dark.png"
              alt="Delta"
              width={130}
              height={58}
              priority
              unoptimized
              style={{ objectFit: "contain" }}
            />
          </div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            style={{ marginBottom: 32 }}
          >
            <h1 style={{
              fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em",
              lineHeight: 1.1, color: "hsl(222 47% 11%)", marginBottom: 8,
            }}>
              Create account
            </h1>
            <p style={{ fontSize: 13, color: "hsl(215 16% 47%)", lineHeight: 1.65 }}>
              Get started with mediaERP for free
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(d => register_.mutate(d))}>

            {/* ── Full name ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.35 }}
              style={{ marginBottom: 16 }}
            >
              <label htmlFor="name" style={labelStyle(focused === "name")}>Full name</label>
              <IconInput
                id="name" type="text" autoComplete="name" placeholder="Alex Smith"
                icon={UserRound} focused={focused === "name"}
                onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                hasError={!!errors.name} registration={register("name")}
              />
              {errors.name && <FieldError msg={errors.name.message} />}
            </motion.div>

            {/* ── Email ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.19, duration: 0.35 }}
              style={{ marginBottom: 16 }}
            >
              <label htmlFor="email" style={labelStyle(focused === "email")}>Email address</label>
              <IconInput
                id="email" type="email" autoComplete="email" placeholder="you@company.com"
                icon={Mail} focused={focused === "email"}
                onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                hasError={!!errors.email} registration={register("email")}
              />
              {errors.email && <FieldError msg={errors.email.message} />}
            </motion.div>

            {/* ── Password ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.35 }}
              style={{ marginBottom: 28 }}
            >
              <label htmlFor="password" style={labelStyle(focused === "password")}>Password</label>
              <IconInput
                id="password" type={showPwd ? "text" : "password"}
                autoComplete="new-password" placeholder="Min. 8 characters"
                icon={Lock} focused={focused === "password"}
                onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                hasError={!!errors.password} registration={register("password")}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      color: "hsl(215 16% 60%)", transition: "color 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                    onMouseLeave={e => (e.currentTarget.style.color = "hsl(215 16% 60%)")}
                  >
                    {showPwd ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                }
              />
              {errors.password && <FieldError msg={errors.password.message} />}
            </motion.div>

            {/* ── CTA Button ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.30, duration: 0.35 }}
            >
              <button
                type="submit"
                disabled={register_.isPending}
                className="delta-btn group w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  height: 48, width: "100%",
                  background: BLUE, color: "#fff",
                  border: "none",
                  cursor: register_.isPending ? "not-allowed" : "pointer",
                  fontSize: 15, fontWeight: 800,
                }}
              >
                {register_.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="size-[15px] transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          {/* Sign-in link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.40, duration: 0.35 }}
            style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "hsl(215 16% 55%)" }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
            >
              Sign in
            </Link>
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelStyle(active: boolean): React.CSSProperties {
  return {
    display: "block",
    fontSize: 10, fontWeight: 700,
    letterSpacing: "0.14em", textTransform: "uppercase",
    marginBottom: 8,
    color: active ? "#0057b8" : "hsl(215 16% 47%)",
    transition: "color 0.2s ease",
  };
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#dc2626" }}>
      <AlertCircle style={{ width: 11, height: 11, flexShrink: 0 }} />
      {msg}
    </p>
  );
}
