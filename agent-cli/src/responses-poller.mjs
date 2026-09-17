// Supabase responses 테이블 폴링(T-018). 개발요청서.md A 항목: 로컬 PC는 인바운드 포트를
// 열지 않으므로, 웹의 응답을 받는 유일한 방법은 로컬 에이전트가 몇 초~10초 간격으로 밖에서
// 안으로(아웃바운드) 물어보는 것이다. 웹훅 수신 서버를 두지 않는다.
//
// 실제 스키마(web-app 트랙 확정, schema-contract.mjs 참고)에는 consumed 같은 처리 여부
// 플래그가 없다 — 로컬 워터마크(poll-state.mjs)로 "이미 처리한 응답"을 구분한다. responses는
// blocked_events와 별 테이블이라 PostgREST 관계 임베딩에 기대지 않고(web-app 쪽 lib/db도 같은
// 이유로 두 번 조회하는 방식을 씀) event_id로 blocked_events를 한 번 더 조회해 type/payload를
// 얻는다.
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { getLastPolledAt, setLastPolledAt } from "./poll-state.mjs";
import { resolveInjectionInput } from "./response-resolver.mjs";

export const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * @param {string} projectId
 * @param {string} sinceIso 이 시각 이후 생성된 응답만
 * @returns {Promise<object[]>} responses 행 배열(created_at 오름차순)
 */
export async function fetchNewResponses(projectId, sinceIso) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLES.RESPONSES)
    .select("id, event_id, choice, responded_by, created_at")
    .eq("project_id", projectId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`responses 조회 실패: ${error.message}`);
  return data ?? [];
}

async function fetchEventTypeAndPayload(eventId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLES.BLOCKED_EVENTS)
    .select("type, payload")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`blocked_events 조회 실패: ${error.message}`);
  if (!data) throw new Error(`응답이 가리키는 이벤트를 찾을 수 없습니다: ${eventId}`);
  return data;
}

/**
 * 폴링 루프를 시작한다. 새 응답을 찾을 때마다 해당 이벤트를 조회해 정규화한 뒤
 * onResponse(normalized)를 호출하고, 성공하면 워터마크를 그 응답의 created_at으로 전진시킨다.
 * onResponse가 예외를 던지면 워터마크를 전진시키지 않는다(다음 폴링에서 재시도 — at-least-once).
 * @param {string} projectId
 * @param {(normalized: {type:string, optionIndex?:number, decision?:string}) => Promise<void>} onResponse
 * @param {{intervalMs?: number}} opts
 * @returns {() => void} stop 함수
 */
export function startResponsePolling(projectId, onResponse, opts = {}) {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const since = getLastPolledAt(projectId);
      const responses = await fetchNewResponses(projectId, since);
      for (const response of responses) {
        if (stopped) break;
        try {
          const event = await fetchEventTypeAndPayload(response.event_id);
          const normalized = resolveInjectionInput(response, event);
          await onResponse(normalized);
          setLastPolledAt(projectId, response.created_at);
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
