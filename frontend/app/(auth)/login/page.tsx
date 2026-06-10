"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useLogin } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { api } from "@/lib/axios";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof schema>;

export default function LoginPage() {
  const login        = useLogin();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError,   setSsoError]   = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(schema) });

  // SSO auto-login from Root ERP
  useEffect(() => {
    const ssoToken = searchParams.get("sso");
    if (!ssoToken) return;
    setSsoLoading(true);
    api.post("/auth/sso-login", { ssoToken })
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
      .catch(() => { setSsoLoading(false); setSsoError("SSO login failed. Please sign in manually."); });
  }, [searchParams, router]);

  if (ssoLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
        <p className="text-sm text-muted-foreground">Signing you in via Root ERP…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((data) => login.mutate(data))}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        {ssoError && <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{ssoError}</p>}
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Sign in to your mediaERP account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Sign up
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
