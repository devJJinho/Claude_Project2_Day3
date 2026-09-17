// 파싱한 토큰 사용량(log-parser.mjs)을 Supabase usage_logs에 적재(T-031).
//
// 실제 usage_logs 스키마(web-app 트랙 마이그레이션 확인, schema-contract.mjs 참고):
// { id uuid PK(자동), project_id, session_id, model, input_tokens, output_tokens, recorded_at }.
// request_id/cache_* 컬럼도, (project_id, request_id) 유니크 제약도 없다 — log-parser.mjs가
// 뽑아내는 requestId/cache 토큰 값은 이 테이블에는 보내지 않는다(향후 컬럼이 추가되면 여기만
// 고치면 됨). 유니크 제약이 없으므로 매번 로그 파일 전체를 다시 올리면 중복이 쌓인다 — 그래서
// poll-state.mjs의 로컬 워터마크(lastUsageSyncedAt)로 "이미 올린 것 이후"만 골라 올린다.
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { collectUsageForProject } from "./log-parser.mjs";
import { getLastUsageSyncedAt, setLastUsageSyncedAt } from "./poll-state.mjs";

function toRow(projectId, record) {
  return {
    project_id: projectId,
    session_id: record.sessionId,
    model: record.model,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    recorded_at: record.timestamp,
  };
}

/**
 * @param {string} projectId
 * @param {object[]} records log-parser.mjs가 반환한 usage 레코드 배열(이미 워터마크 이후 것만)
 * @returns {Promise<number>} 적재한 행 수
 */
export async function uploadUsageRecords(projectId, records) {
  if (records.length === 0) return 0;
  const supabase = getSupabaseClient();
  const rows = records.filter((r) => r.timestamp).map((r) => toRow(projectId, r));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(TABLES.USAGE_LOGS).insert(rows);
  if (error) throw new Error(`usage_logs insert 실패: ${error.message}`);
  return rows.length;
}

/**
 * 로그 파일에서 읽어 워터마크 이후 것만 업로드하고, 성공하면 워터마크를 전진시킨다.
 * daemon.mjs가 주기적으로 호출한다.
 * @param {string} projectId
 * @param {string} projectCwd
 */
export async function syncUsageForProject(projectId, projectCwd) {
  const since = getLastUsageSyncedAt(projectId);
  const all = await collectUsageForProject(projectCwd);
  const fresh = all.filter((r) => r.timestamp && r.timestamp > since);
  if (fresh.length === 0) return 0;
  const uploaded = await uploadUsageRecords(projectId, fresh);
  const latest = fresh.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), since);
  setLastUsageSyncedAt(projectId, latest);
  return uploaded;
}
