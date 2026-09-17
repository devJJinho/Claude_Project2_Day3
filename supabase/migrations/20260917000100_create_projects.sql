-- T-005: projects 테이블 (G 항목 — project_id 기반 다중 프로젝트 확장 설계)
--
-- project_id를 인조 uuid가 아니라 그 자체로 primary key인 안정적 문자열로 둔다 — 로컬 CLI,
-- .claude/settings.json에 심는 훅, tmux 세션 이름(`tmux new -s <project_id>`) 등 여러 곳에서
-- 그대로 참조하는 "사람이 다루는 식별자"이기 때문에, 매번 uuid로 조인하기보다 이 값 자체를
-- 외래키로 참조하는 편이 다른 트랙(로컬 에이전트) 구현을 단순하게 만든다.
--
-- client_ref: `claudebridge init`을 같은 프로젝트 디렉터리에서 실수로 다시 실행했을 때 중복
--등록을 막기 위한 선택적 idempotency 키(T-040 API 계약 참고). 값이 없으면(과거 호출 등) null
-- 허용.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  project_id text primary key,
  name text not null check (char_length(name) between 1 and 100),
  client_ref text unique,
  created_at timestamptz not null default now()
);

comment on table public.projects is 'ClaudeBridge가 관리하는 프로젝트 목록. project_id는 POST /api/projects(T-040)가 발급.';

alter table public.projects enable row level security;
-- 의도적으로 정책을 하나도 만들지 않는다: 이 앱은 브라우저에서 Supabase를 직접 호출하지 않고
-- 모든 접근이 서버의 서비스 롤 키(RLS를 우회함)로만 이뤄진다(개발요청서.md I 항목). RLS를 켜
-- 두면 만에 하나 anon/authenticated 키가 노출되더라도 기본값은 "전부 거부"가 된다.
