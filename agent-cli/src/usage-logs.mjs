// 파싱한 토큰 사용량(log-parser.mjs)을 Supabase usage_logs에 적재(T-031).
// 같은 requestId를 중복 적재하지 않도록 (project_id, request_id) 기준 upsert를 가정한다
// (schema-contract.mjs 참고 — 실제 유니크 제약은 다른 트랙의 마이그레이션에서 확정).
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { collectUsageForProject } from "./log-parser.mjs";

function toRow(projectId, record) {
  return {
    project_id: projectId,
    session_id: record.sessionId,
    request_id: record.requestId,
    model: record.model,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    cache_creation_input_tokens: record.cacheCreationInputTokens,
    cache_read_input_tokens: record.cacheReadInputTokens,
    occurred_at: record.timestamp,
  };
}

/**
 * @param {string} projectId
 * @param {object[]} records log-parser.mjs가 반환한 usage 레코드 배열
 * @returns {Promise<number>} 적재 시도한 행 수
 */
export async function uploadUsageRecords(projectId, records) {
  if (records.length === 0) return 0;
  const supabase = getSupabaseClient();
  // requestId가 없는 레코드(드묾)는 업서트 키가 없어 건너뛴다 — 중복 적재보다 누락이 안전.
  const rows = records.filter((r) => r.requestId).map((r) => toRow(projectId, r));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from(TABLES.USAGE_LOGS)
    .upsert(rows, { onConflict: "project_id,request_id", ignoreDuplicates: true });
  if (error) throw new Error(`usage_logs upsert 실패: ${error.message}`);
  return rows.length;
}

/**
 * 로그 파일에서 읽어 바로 업로드까지 하는 편의 함수. daemon.mjs가 주기적으로 호출한다.
 * @param {string} projectId
 * @param {string} projectCwd
 */
export async function syncUsageForProject(projectId, projectCwd) {
  const records = await collectUsageForProject(projectCwd);
  return uploadUsageRecords(projectId, records);
}
