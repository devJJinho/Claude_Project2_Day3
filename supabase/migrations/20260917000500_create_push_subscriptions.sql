-- T-032: push_subscriptions 테이블 (F 항목 — 웹 푸시 구독 저장)
--
-- 이 프로젝트는 1인 전용(C 항목)이라 user_email은 사실상 항상 화이트리스트의 그 한 이메일
-- 하나지만, 컬럼을 미리 두면 나중에 사용자가 늘어나거나 기기가 여러 대(브라우저별 구독이
-- 여러 개)여도 스키마 변경이 필요 없다. endpoint(브라우저가 발급하는 구독 고유 URL)에
-- unique 제약을 걸어 같은 기기/브라우저의 재구독을 upsert로 처리한다.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null check (char_length(user_email) between 1 and 320),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is '브라우저 Push API 구독 정보. 실제 발송은 로컬 에이전트(.worktrees/agent-cli)가 담당 — 이 웹 앱은 등록만 한다.';

alter table public.push_subscriptions enable row level security;
-- 정책 없음 = 서비스 롤 키만 접근 가능 (T-005 주석 참고).
