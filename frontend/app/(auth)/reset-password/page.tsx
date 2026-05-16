"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Password reset is now handled entirely via OTP on the forgot-password page.
 * Old token-based reset links redirect here — send them to forgot-password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);

  return null;
}
