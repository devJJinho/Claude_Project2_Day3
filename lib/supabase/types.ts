// supabase/migrations/*.sql과 1:1로 대응하는 타입. 마이그레이션을 바꾸면 이 파일도 같이
// 바꾼다(수동 동기화 — 이 프로젝트는 supabase CLI로 타입을 자동 생성할 실제 프로젝트가 아직
// 없다, T-003 참고).

export type BlockedEventType = "ask_user_question" | "permission";
export type BlockedEventStatus = "pending" | "resolved";

export interface ProjectRow {
  project_id: string;
  name: string;
  client_ref: string | null;
  created_at: string;
}

export interface AskUserQuestionPayload {
  question: string;
  options: string[];
}

export interface PermissionPayload {
  tool: string;
  command: string;
  description?: string;
}

export interface BlockedEventRow {
  id: string;
  project_id: string;
  type: BlockedEventType;
  payload: AskUserQuestionPayload | PermissionPayload;
  status: BlockedEventStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ResponseRow {
  id: string;
  event_id: string;
  project_id: string;
  choice: string;
  responded_by: string;
  created_at: string;
}

export interface UsageLogRow {
  id: string;
  project_id: string;
  session_id: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  recorded_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_email: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// /status(Usage 탭)를 tmux로 스크래핑한 최신 스냅샷 1건 (사용자 요청 2026-09-17).
export interface UsageQuotaRow {
  project_id: string;
  session_percent_used: number;
  session_resets_at: string;
  week_percent_used: number;
  week_resets_at: string;
  updated_at: string;
}

// 백로그 태스크 1건 — .claude/tools/backlog-schema.mjs의 스키마를 그대로 반영(느슨하게).
// 등록된 프로젝트마다 category/status 값 구성이 다를 수 있어 status만 유니온으로 좁히고
// 나머지는 string으로 둔다.
export type BacklogTaskStatus = "todo" | "doing" | "done" | "blocked" | "needs_info";
export interface BacklogTask {
  id: string;
  title: string;
  category: string;
  status: BacklogTaskStatus | string;
  source_section?: string;
  deps?: string[];
  parent?: string;
  note?: string;
}

// 등록된 프로젝트의 로컬 backlog.json 전체 스냅샷 (사용자 요청 2026-09-17).
export interface BacklogSnapshotRow {
  project_id: string;
  project_name: string | null;
  source_hash: string | null;
  tasks: BacklogTask[];
  synced_at: string;
}
