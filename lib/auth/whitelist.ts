// T-012: 이메일 화이트리스트 검증. middleware.ts(Edge 런타임)와 일반 서버 코드(Node 런타임)
// 양쪽에서 쓰이므로 의도적으로 "server-only"에 의존하지 않는다 — ALLOWED_EMAILS는 비밀값이
// 아니라(누가 로그인 허용됐는지는 노출돼도 안전) 두 런타임 모두에서 안전하게 읽을 수 있는 일반
// 환경변수로 둔다. 서비스 롤 키 같은 실제 비밀값은 전부 lib/env/server.ts(“server-only”)로만
// 접근한다.
export const DEFAULT_ALLOWED_EMAILS = ["jhjeong710@gmail.com"];

export function parseAllowList(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_ALLOWED_EMAILS;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_EMAILS;
}

export function isWhitelistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAllowList(process.env.ALLOWED_EMAILS).includes(email.trim().toLowerCase());
}
