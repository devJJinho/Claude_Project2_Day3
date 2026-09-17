import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

// 서비스 롤 키를 쓰는 유일한 진입점(개발요청서.md I 항목). 절대 "use client" 컴포넌트나
// app/**/page.tsx의 브라우저로 넘어가는 코드 경로에서 이 모듈을 import하지 않는다 —
// "server-only"가 실수를 빌드 타임 에러로 바꿔준다.
//
// 매 호출마다 새 클라이언트를 만들지 않도록 지연 생성 후 캐시한다(모듈이 로드될 때 즉시
// serverEnv를 평가하면 .env.local이 없는 환경에서 import만으로도 에러가 나므로, 최초 실제
// 사용 시점까지 미룬다).
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
