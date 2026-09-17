// Supabase 테이블 계약 — web-app 트랙(다른 worktree, feature/web-app 브랜치)이 실제로
// 구현한 스키마를 그대로 반영한다(더 이상 가정이 아니라 확인된 사실).
//
// 출처: origin/feature/web-app 커밋 c092c82(2026-09-17, "ClaudeBridge 웹 앱 스캐폴드 +
// 인증/DB/대시보드/API 구현")의 lib/supabase/types.ts, supabase/migrations/2026091700{01~06}00_*.sql,
// lib/db/{projects,events,responses,push}.ts, app/api/{projects,responses,permissions}/route.ts를
// `git show origin/feature/web-app:<path>`로 직접 읽어 확인했다(해당 worktree 디렉터리로
// 들어가거나 그 안의 파일을 수정하지 않고, git 오브젝트만 읽기 전용으로 조회).

export const TABLES = Object.freeze({
  PROJECTS: "projects",
  BLOCKED_EVENTS: "blocked_events",
  RESPONSES: "responses",
  USAGE_LOGS: "usage_logs",
  PUSH_SUBSCRIPTIONS: "push_subscriptions",
  USAGE_QUOTA: "usage_quota",
  BACKLOG_SNAPSHOT: "project_backlog_snapshot",
});

// projects: { project_id (PK, "clb_"+uuid20자, POST /api/projects가 발급), name, client_ref, created_at }

// blocked_events: Claude Code가 AskUserQuestion/Permission으로 멈춘 시점을 기록.
//   id: uuid (PK)
//   project_id: text (FK -> projects.project_id)
//   type: "ask_user_question" | "permission"   ← 필드명은 kind가 아니라 type
//   status: "pending" | "resolved"              ← "answered"가 아니라 "resolved"
//   payload: jsonb
//     - ask_user_question: { question: string, options: string[] }  ← 옵션은 문자열 배열 그대로
//     - permission: { tool: string, command: string, description?: string }
//   created_at, resolved_at

// responses: 사용자가 웹에서 고른 응답. app/api/responses·app/api/permissions가 INSERT하면서
// 동시에 해당 blocked_events.status를 resolved로 바꾼다 — **로컬 에이전트는 이 갱신을 하지
// 않는다**(웹 쪽 책임). consumed 같은 별도 플래그 컬럼은 없다 — 로컬 에이전트는 자체적으로
// created_at 워터마크를 로컬에 저장해 "새 응답"을 구분한다(poll-state.mjs).
//   id, event_id (blocked_events.id), project_id, choice (string), responded_by (email), created_at
//   choice 값: ask_user_question이면 해당 이벤트 payload.options 중 하나(문자열 그대로),
//              permission이면 "approve" | "deny" 둘 중 하나. (웹 API가 이미 검증해서 넣으므로
//              로컬 에이전트는 신뢰하되, optionIndex 계산 실패 등 방어적 처리는 한다.)

// usage_logs: { id, project_id, session_id, model, input_tokens, output_tokens, recorded_at }
//   주의: cache_creation_input_tokens/cache_read_input_tokens 컬럼은 실제 마이그레이션에는
//   없다(log-parser.mjs는 참고용으로 계속 뽑아두되, upload 시에는 실제 컬럼만 보낸다).

// push_subscriptions: { id, user_email, endpoint (unique), p256dh, auth, created_at }
//   로컬 에이전트(T-033)는 이 테이블을 읽기만 한다.

// usage_quota: { project_id (PK), session_percent_used, session_resets_at, week_percent_used,
//   week_resets_at, updated_at } — /status 화면(Usage 탭)을 tmux로 스크래핑한 최신 값 1건
//   (사용자 요청 2026-09-17: "토큰 사용량은 /status 조회했을 때 보이는 잔여량"). upsert 전용
//   (project_id가 PK라 매번 덮어쓴다).

// project_backlog_snapshot: { project_id (PK), project_name, source_hash, tasks (jsonb),
//   synced_at } — 등록된 프로젝트의 로컬 backlog.json 전체 스냅샷(사용자 요청 2026-09-17:
//   "backlog.json 파일의 내용이 웹에서 보이지 않는다"). tasks는 backlog.json의 tasks 배열을
//   그대로 담는다(가공 없이). upsert 전용.

export function assertKnownTable(name) {
  if (!Object.values(TABLES).includes(name)) {
    throw new Error(`알 수 없는 테이블: ${name} — schema-contract.mjs에 없는 이름입니다.`);
  }
  return name;
}
