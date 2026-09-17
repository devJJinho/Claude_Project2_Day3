import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import type { AskUserQuestionPayload, BlockedEventType } from "@/lib/supabase/types";

export class InvalidChoiceError extends Error {}
export class EventNotFoundError extends Error {}
export class EventAlreadyResolvedError extends Error {}

/**
 * 웹에서 로컬로 전달 가능한 신호는 화이트리스트화된 선택지/승인 응답으로만 한정한다
 * (개발요청서.md I 항목) — 이 함수가 그 경계를 강제하는 유일한 지점이다. AskUserQuestion은
 * payload.options에 있는 문자열만, Permission은 'approve'|'deny'만 허용한다.
 */
function assertValidChoice(event: { type: string; payload: unknown }, choice: string): void {
  if (event.type === "ask_user_question") {
    const options = (event.payload as AskUserQuestionPayload).options ?? [];
    if (!options.includes(choice)) {
      throw new InvalidChoiceError(`choice는 사전 정의된 옵션 중 하나여야 합니다: ${options.join(", ")}`);
    }
    return;
  }
  if (event.type === "permission") {
    if (choice !== "approve" && choice !== "deny") {
      throw new InvalidChoiceError("permission 이벤트의 choice는 'approve' 또는 'deny'만 허용됩니다.");
    }
    return;
  }
  throw new InvalidChoiceError(`알 수 없는 이벤트 타입: ${event.type}`);
}

export async function recordResponse(input: {
  eventId: string;
  choice: string;
  respondedBy: string;
  /** 지정하면 이벤트 타입이 이 값과 다를 때 거부한다 — /api/responses와 /api/permissions가
   * 서로 다른 타입의 이벤트를 잘못 처리하지 않게 하는 방어선(T-026/T-027). */
  expectedType?: BlockedEventType;
}): Promise<void> {
  const event = await getEventById(input.eventId);
  if (!event) throw new EventNotFoundError(`이벤트를 찾을 수 없습니다: ${input.eventId}`);
  if (event.status === "resolved") {
    throw new EventAlreadyResolvedError("이미 응답이 기록된 이벤트입니다.");
  }
  if (input.expectedType && event.type !== input.expectedType) {
    throw new InvalidChoiceError(`이 엔드포인트는 ${input.expectedType} 타입 이벤트만 처리합니다.`);
  }
  assertValidChoice(event, input.choice);

  const supabase = getSupabaseAdmin();
  const { error: insertError } = await supabase.from("responses").insert({
    event_id: event.id,
    project_id: event.project_id,
    choice: input.choice,
    responded_by: input.respondedBy,
  });
  if (insertError) throw new Error(`응답 기록 실패: ${insertError.message}`);

  const { error: updateError } = await supabase
    .from("blocked_events")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", event.id);
  if (updateError) throw new Error(`이벤트 상태 갱신 실패: ${updateError.message}`);
}
