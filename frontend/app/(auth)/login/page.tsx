"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import api from "@/lib/axios";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const AMBER    = "rgba(245,193,55,1)";
const AMBER_50 = "rgba(245,193,55,0.5)";

// Shared styles for classic rounded inputs
const inputBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  fontSize: 14,
  borderRadius: 10,
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.9)",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
};
const inputFocused: React.CSSProperties = {
  ...inputBase,
  background: "rgba(255,255,255,0.075)",
  border: "1px solid rgba(245,193,55,0.38)",
  boxShadow: "0 0 0 3px rgba(245,193,55,0.09)",
};

export default function LoginPage() {
  const login  = useLogin();
  const router = useRouter();

  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError,   setSsoError]   = useState<string | null>(null);
  const [showPwd,    setShowPwd]    = useState(false);
  const [focused,    setFocused]    = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("sso");
    if (!token) return;
    setSsoLoading(true);
    api.post("/auth/sso-login", { ssoToken: token })
      .then(res => {
        const { access_token, refresh_token } = res.data?.data ?? res.data ?? {};
        if (access_token) {
          localStorage.setItem("access_token", access_token);
          if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
          router.replace("/dashboard");
        } else {
          setSsoLoading(false);
          setSsoError("SSO login failed. Please sign in manually.");
        }
      })
      .catch(() => {
        setSsoLoading(false);
        setSsoError("SSO login failed. Please sign in manually.");
      });
  }, [router]);

  if (ssoLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/10"
          style={{ borderTopColor: AMBER }}
        />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)" }}>
          Signing you in via Root ERP…
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .auth-input::placeholder { color: rgba(255,255,255,0.22) !important; }
        .auth-input:focus        { outline: none !important; box-shadow: none !important; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.965 }}
        animate={{ opacity: 1, y: 0,  scale: 1     }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 420 }}
      >
        {/* ── GLASSMORPHIC CARD ── */}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            background: "linear-gradient(155deg, rgba(12,12,20,0.82) 0%, rgba(8,8,14,0.88) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow:
              "0 0 0 1px rgba(245,193,55,0.07)," +
              "0 8px 32px rgba(0,0,0,0.45)," +
              "0 40px 90px rgba(0,0,0,0.55)," +
              "inset 0 1px 0 rgba(255,255,255,0.07)",
            backdropFilter: "blur(40px) saturate(200%) brightness(0.85)",
            WebkitBackdropFilter: "blur(40px) saturate(200%) brightness(0.85)",
            overflow: "hidden",
          }}
        >
          {/* Amber shimmer — top edge */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(245,193,55,0.6) 35%, rgba(245,193,55,0.6) 65%, transparent)",
              borderRadius: "22px 22px 0 0",
            }}
          />
          {/* Inner top-left glow */}
          <div
            style={{
              position: "absolute", top: -80, left: -80,
              width: 240, height: 240, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,193,55,0.055) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ padding: "40px 38px 36px" }}>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              style={{ marginBottom: 30 }}
            >
              <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, color: "rgba(255,255,255,0.93)", marginBottom: 8 }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.33)", lineHeight: 1.65 }}>
                Enter your credentials to continue
              </p>
            </motion.div>

            {/* SSO error */}
            {ssoError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: 20,
                  display: "flex", alignItems: "flex-start", gap: 10,
                  borderRadius: 12, padding: "11px 14px",
                  fontSize: 12, lineHeight: 1.5,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.22)",
                  color: "#f87171",
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                {ssoError}
              </motion.div>
            )}

            <form onSubmit={handleSubmit(d => login.mutate(d))}>

              {/* ── Email ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.35 }}
                style={{ marginBottom: 18 }}
              >
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: 9.5, fontWeight: 700,
                    letterSpacing: "0.17em", textTransform: "uppercase",
                    marginBottom: 8,
                    color: focused === "email" ? AMBER_50 : "rgba(255,255,255,0.25)",
                    transition: "color 0.2s ease",
                  }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="auth-input"
                  style={focused === "email" ? inputFocused : inputBase}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  {...register("email")}
                />
                {errors.email && (
                  <p style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171" }}>
                    <AlertCircle style={{ width: 11, height: 11, flexShrink: 0 }} />
                    {errors.email.message}
                  </p>
                )}
              </motion.div>

              {/* ── Password ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.35 }}
                style={{ marginBottom: 26 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label
                    htmlFor="password"
                    style={{
                      fontSize: 9.5, fontWeight: 700,
                      letterSpacing: "0.17em", textTransform: "uppercase",
                      color: focused === "password" ? AMBER_50 : "rgba(255,255,255,0.25)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    style={{ fontSize: 11, color: "rgba(245,193,55,0.5)", textDecoration: "none", transition: "color 0.15s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.color = AMBER)}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,193,55,0.5)")}
                  >
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="auth-input"
                    style={{
                      ...(focused === "password" ? inputFocused : inputBase),
                      paddingRight: 42,
                    }}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      color: "rgba(255,255,255,0.3)",
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                  >
                    {showPwd ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171" }}>
                    <AlertCircle style={{ width: 11, height: 11, flexShrink: 0 }} />
                    {errors.password.message}
                  </p>
                )}
              </motion.div>

              {/* ── CTA Button ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.35 }}
              >
                <button
                  type="submit"
                  disabled={login.isPending}
                  className="group w-full flex items-center justify-center gap-2 font-bold text-sm
                             transition-all duration-200
                             hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(245,193,55,0.32),0_6px_18px_rgba(245,193,55,0.18)]
                             active:scale-[0.985]
                             disabled:opacity-55 disabled:cursor-not-allowed"
                  style={{
                    height: 45,
                    borderRadius: 10,
                    border: "none",
                    cursor: login.isPending ? "not-allowed" : "pointer",
                    background: "oklch(0.795 0.184 86.047)",
                    color: "oklch(0.32 0.09 57.7)",
                    letterSpacing: "0.03em",
                    boxShadow: "0 0 18px rgba(245,193,55,0.16), 0 4px 12px rgba(245,193,55,0.1)",
                  }}
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="size-[15px] transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Sign-up link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              style={{ marginTop: 22, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.24)" }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                style={{ color: "rgba(245,193,55,0.6)", fontWeight: 600, textDecoration: "none", transition: "color 0.15s ease" }}
                onMouseEnter={e => (e.currentTarget.style.color = AMBER)}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,193,55,0.6)")}
              >
                Sign up
              </Link>
            </motion.p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
