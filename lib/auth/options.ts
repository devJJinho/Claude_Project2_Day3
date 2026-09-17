import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { serverEnv } from "@/lib/env/server";
import { isWhitelistedEmail } from "@/lib/auth/whitelist";

// T-011(구글 로그인) + T-012(화이트리스트)를 한 곳에서 구성한다. DB 어댑터를 쓰지 않고
// JWT 세션 전략만 사용한다 — 사용자 1명(jhjeong710@gmail.com)뿐이라 세션을 Supabase에
// 영속시킬 이유가 없고(C 항목: 별도 권한 등급 없음), Vercel의 서버리스 환경에 가장 잘
// 맞는 방식이다.
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: serverEnv.googleClientId,
      clientSecret: serverEnv.googleClientSecret,
    }),
  ],
  secret: serverEnv.nextAuthSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // 화이트리스트에 없는 구글 계정은 로그인 자체를 거부한다(C 항목) — middleware.ts의
    // 라우트 보호는 "이미 세션이 있는데 이메일이 화이트리스트 밖인 경우"에 대한 방어선이고,
    // 이 콜백은 애초에 세션이 만들어지는 것 자체를 막는 1차 방어선이다.
    async signIn({ user }) {
      return isWhitelistedEmail(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === "string") {
        session.user.email = token.email;
      }
      return session;
    },
  },
};
