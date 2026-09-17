import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { isWhitelistedEmail } from "@/lib/auth/whitelist";

// T-012: /dashboard 이하 전체를 보호한다. lib/auth/options.ts의 signIn 콜백이 애초에
// 화이트리스트 밖 계정의 로그인을 막지만, 이 미들웨어는 두 번째 방어선이다 — 예를 들어
// ALLOWED_EMAILS를 나중에 좁혔는데 예전 세션 쿠키가 아직 유효한 경우까지 커버한다.
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !isWhitelistedEmail(typeof token.email === "string" ? token.email : null)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
