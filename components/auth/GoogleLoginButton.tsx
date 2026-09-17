"use client";

import { signIn } from "next-auth/react";

export function GoogleLoginButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <button className="google-login-btn" onClick={() => signIn("google", { callbackUrl: callbackUrl ?? "/dashboard" })}>
      Google 계정으로 로그인
    </button>
  );
}
