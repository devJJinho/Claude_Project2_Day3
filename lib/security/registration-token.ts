import "server-only";
import { serverEnv } from "@/lib/env/server";

// T-040: POST /api/projects는 사람(브라우저 세션)이 아니라 로컬 CLI(.worktrees/agent-cli의
// claudebridge init)가 호출한다 — 그래서 next-auth 세션이 아니라 별도의 공유 비밀값
// Authorization: Bearer <CLAUDEBRIDGE_REGISTRATION_TOKEN>으로 인증한다. 개발요청서.md 4장의
// "개인 액세스 토큰 발급 방식"이 아직 미결이라 임시로 정적 토큰 비교 방식을 쓴다(README/보고서
// 참고 — 나중에 claudebridge login이 발급하는 토큰 체계로 교체될 수 있음).
export function isAuthorizedRegistrationRequest(authorizationHeader: string | null): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 && token === serverEnv.registrationToken;
}
