// 감지된 이벤트(AskUserQuestion/Permission)를 Supabase blocked_events에 기록(T-017).
// 실제 스키마는 schema-contract.mjs 참고(web-app 트랙 T-006 구현을 그대로 반영 — type 필드,
// status는 pending/resolved). ask-question-hook.mjs / permission-hook.mjs가 이 함수를 호출한다.
//
// status를 resolved로 되돌리는 함수는 여기 두지 않는다 — web-app의 app/api/responses,
// app/api/permissions(lib/db/responses.ts recordResponse)가 응답을 기록하면서 동시에
// blocked_events.status를 resolved로 갱신하는 것까지 책임진다(로컬 에이전트가 다시 갱신하면
// 책임이 겹친다).
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";

/**
 * @param {object} params
 * @param {string} params.projectId
 * @param {"ask_user_question"|"permission"} params.type
 * @param {object} params.payload ask_user_question: {question, options:string[]} / permission: {tool, command, description?}
 * @returns {Promise<{id: string}>} 생성된 blocked_events 행의 id
 */
export async function recordBlockedEvent({ projectId, type, payload }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLES.BLOCKED_EVENTS)
    .insert({ project_id: projectId, type, status: "pending", payload })
    .select("id")
    .single();
  if (error) throw new Error(`blocked_events insert 실패: ${error.message}`);
  return data;
}
