// responses 행(raw: {id, event_id, choice, ...})과 그 응답이 속한 blocked_events 행
// (type, payload)을 합쳐 "tmux에 주입할 수 있는 형태"로 정규화하는 순수 함수. Supabase/tmux에
// 의존하지 않아 네트워크 없이 단위 테스트 가능하다(scripts/smoke-test.mjs).
import { UnrecognizedResponseError } from "./key-mapping.mjs";

/**
 * @param {{choice: string}} response
 * @param {{type: "ask_user_question"|"permission", payload: object}} event
 * @returns {{type: "ask_user_question", optionIndex: number} | {type: "permission", decision: string}}
 */
export function resolveInjectionInput(response, event) {
  if (event.type === "ask_user_question") {
    const options = event.payload?.options ?? [];
    const idx = options.indexOf(response.choice);
    if (idx === -1) {
      throw new UnrecognizedResponseError(
        "ask_user_question choice",
        `${response.choice} (이벤트 옵션: ${options.join(", ")})`
      );
    }
    return { type: "ask_user_question", optionIndex: idx + 1 };
  }
  if (event.type === "permission") {
    return { type: "permission", decision: response.choice };
  }
  throw new UnrecognizedResponseError("blocked_event.type", event.type);
}
