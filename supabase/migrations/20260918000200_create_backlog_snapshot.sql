-- 사용자 요청(2026-09-17): "실제 프로젝트가 연결됐음에도 backlog.json 파일의 내용이 웹에서
-- 안 보인다" — 개발요청서.md 1장("웹 대시보드에서 진행 상황(백로그/진행률) 확인")이 원래
-- 요구했던 기능인데, T-024 구현 당시 "이벤트(blocked_events) 상태 분포"로 대체 구현되어
-- 실제로는 등록된 프로젝트의 backlog.json 내용을 동기화하는 기능 자체가 없었다(스코프 누락).
--
-- 로컬 에이전트가 등록된 프로젝트 디렉터리의 backlog.json을 주기적으로 읽어(Claude Code의
-- backlog-cli.mjs를 거치지 않고 직접 fs로 읽는다 — 이건 조회 전용 스냅샷이지 Claude Code
-- 세션의 도구 호출이 아니므로 require-backlog-cli.mjs 훅 대상이 아니다) 그 전체 tasks 배열을
-- 그대로 스냅샷으로 올린다. 프로젝트당 최신 스냅샷 1개만 유지한다(이력이 아니라 "지금 상태").
create table if not exists public.project_backlog_snapshot (
  project_id text primary key references public.projects (project_id) on delete cascade,
  project_name text,
  source_hash text,
  tasks jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

comment on table public.project_backlog_snapshot is '등록된 프로젝트의 로컬 backlog.json 전체 스냅샷(로컬 에이전트가 주기적으로 동기화).';

create index if not exists project_backlog_snapshot_synced_idx
  on public.project_backlog_snapshot (synced_at desc);

alter table public.project_backlog_snapshot enable row level security;
-- 정책 없음 = 서비스 롤 키만 접근 가능 (다른 테이블과 동일한 원칙, T-005 주석 참고).
