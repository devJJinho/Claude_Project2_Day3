-- T-006: blocked_events 테이블 (B 항목 — AskUserQuestion/Permission 대기 이벤트)
--
-- payload는 두 종류의 이벤트가 서로 다른 모양을 가지므로 jsonb로 둔다:
--   type='ask_user_question' -> {"question": string, "options": string[]}
--   type='permission'        -> {"tool": string, "command": string, "description"?: string}
-- 웹은 이 payload를 "표시"만 하고 절대 자유 텍스트를 되돌려 보내지 않는다(응답은 항상
-- options 배열의 값 또는 approve/deny 중 하나 — responses 테이블, I 항목).

create table if not exists public.blocked_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (project_id) on delete cascade,
  type text not null check (type in ('ask_user_question', 'permission')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.blocked_events is 'Claude Code 세션이 AskUserQuestion/Permission으로 멈춘 시점의 기록.';

create index if not exists blocked_events_project_status_idx
  on public.blocked_events (project_id, status, created_at desc);

alter table public.blocked_events enable row level security;
-- projects와 동일하게 정책 없음 = 서비스 롤 키만 접근 가능 (T-005 주석 참고).
