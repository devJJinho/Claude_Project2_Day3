-- 사용자 요청(2026-09-17): "토큰 사용량은 /status 조회했을 때 보이는 잔여량, 1주일
-- 잔여량을 보여주도록" — 기존 usage_logs(JSONL에서 파싱한 원시 input/output 토큰 누적치)와는
-- 별개로, Claude Code 자체가 계산해서 보여주는 "이번 세션 사용률 %"와 "이번 주 사용률 %"를
-- 그대로 보여주는 게 사용자가 원하는 값이다. 이 값은 로그 파일에서 계산할 수 없고(내부 요금제별
-- 한도/캐시 토큰 가중치 등을 Claude Code가 알아서 계산) tmux 위에서 실제 Claude Code에게
-- `/status` 화면을 띄워 그 결과를 화면 텍스트로 읽어오는 방법뿐이다(agent-cli/src/quota-scraper.mjs).
--
-- project당 최신 값 1개만 있으면 되므로(이력이 아니라 "지금 얼마나 남았는지") usage_logs처럼
-- append-only가 아니라 project_id를 기본키로 하는 단일 행 upsert 테이블로 둔다.
--
-- reset 시각은 Claude Code가 "11:10pm (Asia/Seoul)"/"Sep 24 at 4pm (Asia/Seoul)"처럼 사람이
-- 읽는 문자열로만 보여준다 — 정확한 타임존/연도 추론까지 이 프로젝트가 대신 할 필요는 없어서
-- (개발자 재량으로 과설계 금지) 그 문자열을 그대로 저장한다. 표시 목적이면 충분하다.

create table if not exists public.usage_quota (
  project_id text primary key references public.projects (project_id) on delete cascade,
  session_percent_used integer not null check (session_percent_used between 0 and 100),
  session_resets_at text not null,
  week_percent_used integer not null check (week_percent_used between 0 and 100),
  week_resets_at text not null,
  updated_at timestamptz not null default now()
);

comment on table public.usage_quota is '/status 화면에서 스크래핑한 세션·주간 사용률(%) 최신 스냅샷 1건.';

alter table public.usage_quota enable row level security;
-- 정책 없음 = 서비스 롤 키만 접근 가능 (다른 테이블과 동일한 원칙, T-005 주석 참고).
