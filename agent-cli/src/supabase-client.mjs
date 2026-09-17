// Supabase 클라이언트 생성(서비스 롤 키 사용 — I 항목: 로컬 환경변수 전용, 프런트엔드 노출 금지).
// 모든 Supabase 접근 모듈(blocked-events.mjs, responses-poller.mjs, usage-logs.mjs,
// push-sender.mjs)은 이 함수 하나로만 클라이언트를 얻는다 — 자격증명 로딩 지점을 하나로 모음.
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceCredentials } from "./config.mjs";

let cached = null;

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 " +
        "않았습니다 — 안전 게이트 2단계(웹 접근 가능 상태 점검)를 통과할 수 없는 상태입니다."
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (cached) return cached;
  const { url, serviceRoleKey } = getSupabaseServiceCredentials();
  if (!url || !serviceRoleKey) throw new SupabaseNotConfiguredError();
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// 테스트/재시작 시 캐시를 비우고 싶을 때(예: 환경변수가 런타임에 바뀐 경우) 사용.
export function resetSupabaseClientCache() {
  cached = null;
}
