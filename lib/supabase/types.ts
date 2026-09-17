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
