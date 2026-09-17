-- T-008: usage_logs 테이블 (E 항목 — 토큰 사용량)
--
-- session_id/model은 nullable로 둔다 — 로컬 세션 로그의 정확한 위치·포맷은 T-029(다른
-- 트랙, agent-cli)에서 조사 확정 예정이라 아직 실제 로그 구조를 알 수 없다. 이 테이블은
-- "무엇이든 파싱해서 넣을 최소 스키마"만 먼저 확정하고, 필드가 더 필요해지면 마이그레이션을
-- 추가한다.

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (project_id) on delete cascade,
  session_id text,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  recorded_at timestamptz not null default now()
);

comment on table public.usage_logs is '로컬 에이전트가 파싱해 적재하는 Claude Code 세션 토큰 사용량(입력/출력).';

create index if not exists usage_logs_project_recorded_idx
  on public.usage_logs (project_id, recorded_at desc);

alter table public.usage_logs enable row level security;
-- 정책 없음 = 서비스 롤 키만 접근 가능 (T-005 주석 참고).
