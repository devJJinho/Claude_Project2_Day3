// Supabase 테이블 계약(가정) — 웹/백엔드 트랙(다른 worktree, T-005~T-011)이 실제로 구현할
// 스키마와 이 로컬 에이전트가 주고받을 최소 계약을 여기 한 곳에 문서화한다. 실제 마이그레이션
// 파일은 이 트랙 소관이 아니라 만들지 않는다 — 이 파일은 "내가 가정하고 코드를 짠 형태"의
// 단일 기준점이며, 나중에 두 트랙을 합칠 때 다르면 이 파일 하나만 보고 맞추면 되게 하기 위함.
//
// project_id 확장 설계(개발요청서.md G 항목)를 지키기 위해 blocked_events/responses/
// usage_logs 모두 project_id를 포함한다고 가정한다.

export const TABLES = Object.freeze({
  PROJECTS: "projects",
  BLOCKED_EVENTS: "blocked_events",
  RESPONSES: "responses",
  USAGE_LOGS: "usage_logs",
  PUSH_SUBSCRIPTIONS: "push_subscriptions",
});

// blocked_events: Claude Code가 AskUserQuestion/Permission으로 멈춘 시점을 기록.
//   id: uuid (PK)
//   project_id: uuid (FK -> projects.id)
//   kind: "ask_user_question" | "permission"
//   status: "pending" | "answered"
//   payload: jsonb
//     - ask_user_question: { question: string, header?: string, options: [{ index:number, label:string }] }
//     - permission: { toolName: string, message: string }
//   created_at: timestamptz
//   answered_at: timestamptz | null

// responses: 사용자가 웹에서 고른 응답. 웹 앱이 INSERT하고, 로컬 에이전트가 폴링해 소비 후
// consumed=true로 UPDATE한다(T-018).
//   id: uuid (PK)
//   blocked_event_id: uuid (FK -> blocked_events.id)
//   project_id: uuid (FK -> projects.id) — 프로젝트별 폴링 필터링용
//   kind: "ask_user_question" | "permission"
//   value: jsonb
//     - ask_user_question: { optionIndex: number }   (1부터 시작, key-mapping.mjs와 동일 규칙)
//     - permission: { decision: "allow_once"|"allow_always"|"deny" }
//   consumed: boolean (기본 false)
//   created_at: timestamptz

// usage_logs: T-030이 파싱한 토큰 사용량 레코드 하나당 한 행.
//   id: uuid (PK), project_id: uuid, session_id, request_id, model,
//   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
//   occurred_at: timestamptz (jsonl의 timestamp), created_at: timestamptz (적재 시각)
//   유니크 제약 가정: (project_id, request_id) — 같은 요청을 중복 적재하지 않기 위해
//   upsert(onConflict: "project_id,request_id")를 사용한다.

// push_subscriptions: 웹 대시보드가 Service Worker 구독을 등록해 저장(T-032, 다른 트랙 소관).
//   id, endpoint, keys jsonb ({p256dh, auth}), created_at.
//   로컬 에이전트(T-033)는 이 테이블을 읽기만 한다.

export function assertKnownTable(name) {
  if (!Object.values(TABLES).includes(name)) {
    throw new Error(`알 수 없는 테이블: ${name} — schema-contract.mjs에 없는 이름입니다.`);
  }
  return name;
}
