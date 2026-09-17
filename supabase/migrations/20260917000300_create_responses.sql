-- T-007: responses 테이블 (B 항목 — 사용자가 웹에서 고른 응답)
--
-- choice는 사전 정의된 값만 허용한다는 정책(B, I 항목)을 애플리케이션 레벨(app/api/responses,
-- app/api/permissions)에서 검증한다 — blocked_events.payload.options 또는 'approve'/'deny'
-- 중 하나가 아니면 API가 거부하므로, 여기서는 자유 텍스트 길이만 방어적으로 제한한다.
-- event_id에 unique 제약을 걸어 "이벤트당 응답 1건"을 DB 레벨에서 보장한다(중복 클릭 방지).

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.blocked_events (id) on delete cascade,
  project_id text not null references public.projects (project_id) on delete cascade,
  choice text not null check (char_length(choice) between 1 and 500),
  responded_by text not null check (char_length(responded_by) between 1 and 320),
  created_at timestamptz not null default now()
);

comment on table public.responses is '웹 대시보드에서 클릭한 선택지/승인·거부 응답. choice는 항상 사전 정의된 값(자유 텍스트 아님).';

create index if not exists responses_project_created_idx
  on public.responses (project_id, created_at desc);

alter table public.responses enable row level security;
-- 정책 없음 = 서비스 롤 키만 접근 가능 (T-005 주석 참고).
