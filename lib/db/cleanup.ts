import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// T-009 (D 항목) 30일 TTL의 두 경로 중 하나 — Vercel Cron이 호출한다(app/api/cron 참고).
// supabase/migrations/20260917000600_ttl_cleanup_policy.sql의 SQL 함수와 조건을 동일하게
// 유지해야 한다(중복 실행돼도 멱등하므로 두 경로가 겹쳐도 안전).
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function deleteExpiredRecords(): Promise<{ responses: number; blockedEvents: number; usageLogs: number }> {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const responses = await supabase.from("responses").delete({ count: "exact" }).lt("created_at", cutoff);
  if (responses.error) throw new Error(`responses 정리 실패: ${responses.error.message}`);

  const blockedEvents = await supabase.from("blocked_events").delete({ count: "exact" }).lt("created_at", cutoff);
  if (blockedEvents.error) throw new Error(`blocked_events 정리 실패: ${blockedEvents.error.message}`);

  const usageLogs = await supabase.from("usage_logs").delete({ count: "exact" }).lt("recorded_at", cutoff);
  if (usageLogs.error) throw new Error(`usage_logs 정리 실패: ${usageLogs.error.message}`);

  return {
    responses: responses.count ?? 0,
    blockedEvents: blockedEvents.count ?? 0,
    usageLogs: usageLogs.count ?? 0,
  };
}
