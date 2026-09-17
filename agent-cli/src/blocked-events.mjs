// 감지된 이벤트(AskUserQuestion/Permission)를 Supabase blocked_events에 기록(T-017).
// 스키마 가정은 schema-contract.mjs 참고. ask-question-hook.mjs / permission-hook.mjs가
// 이 함수를 호출한다.
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";

/**
 * @param {object} params
 * @param {string} params.projectId
 * @param {"ask_user_question"|"permission"} params.kind
 * @param {object} params.payload schema-contract.mjs의 payload 형태
 * @returns {Promise<{id: string}>} 생성된 blocked_events 행의 id(웹 응답을 매칭할 때 필요)
 */
export async function recordBlockedEvent({ projectId, kind, payload }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLES.BLOCKED_EVENTS)
    .insert({ project_id: projectId, kind, status: "pending", payload })
    .select("id")
    .single();
  if (error) throw new Error(`blocked_events insert 실패: ${error.message}`);
  return data;
}

/**
 * 응답을 소비한 뒤(T-018) blocked_events 상태를 answered로 갱신한다.
 * @param {string} blockedEventId
 */
export async function markBlockedEventAnswered(blockedEventId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLES.BLOCKED_EVENTS)
    .update({ status: "answered", answered_at: new Date().toISOString() })
    .eq("id", blockedEventId);
  if (error) throw new Error(`blocked_events update 실패: ${error.message}`);
}
