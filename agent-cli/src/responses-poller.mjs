// Supabase responses 테이블 폴링(T-018). 개발요청서.md A 항목: 로컬 PC는 인바운드 포트를
// 열지 않으므로, 웹의 응답을 받는 유일한 방법은 로컬 에이전트가 몇 초~10초 간격으로 밖에서
// 안으로(아웃바운드) 물어보는 것이다. 웹훅 수신 서버를 두지 않는다.
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { markBlockedEventAnswered } from "./blocked-events.mjs";

export const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * 아직 소비하지 않은(consumed=false) 응답을 project_id 기준으로 가져온다.
 * @param {string} projectId
 * @returns {Promise<object[]>}
 */
export async function fetchUnconsumedResponses(projectId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLES.RESPONSES)
    .select("id, blocked_event_id, kind, value, created_at")
    .eq("project_id", projectId)
    .eq("consumed", false)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`responses 조회 실패: ${error.message}`);
  return data ?? [];
}

/**
 * @param {string} responseId
 */
export async function markResponseConsumed(responseId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLES.RESPONSES).update({ consumed: true }).eq("id", responseId);
  if (error) throw new Error(`responses consumed 갱신 실패: ${error.message}`);
}

/**
 * 폴링 루프를 시작한다. 새 응답을 찾으면 onResponse(response)를 호출하고, 성공하면
 * consumed=true로 표시 + blocked_events를 answered로 갱신한다. onResponse가 예외를 던지면
 * 그 응답은 consumed 처리하지 않는다(다음 폴링에서 재시도 — at-least-once 처리).
 * @param {string} projectId
 * @param {(response: object) => Promise<void>} onResponse
 * @param {{intervalMs?: number, signal?: AbortSignal}} opts
 * @returns {() => void} stop 함수
 */
export function startResponsePolling(projectId, onResponse, opts = {}) {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const responses = await fetchUnconsumedResponses(projectId);
      for (const response of responses) {
        if (stopped) break;
        try {
          await onResponse(response);
          await markResponseConsumed(response.id);
          await markBlockedEventAnswered(response.blocked_event_id);
        } catch (err) {
          console.error(`[responses-poller] 응답 처리 실패(id=${response.id}): ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`[responses-poller] 폴링 실패: ${err.message}`);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  }

  tick();
  return () => {
    stopped = true;
  };
}
