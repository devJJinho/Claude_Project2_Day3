-- T-009: 질문/응답/사용량 30일 자동 삭제 (D 항목)
--
-- projects/push_subscriptions은 TTL 대상이 아니다(D 항목은 "질문·답변 기록 및 토큰 사용량
-- 데이터"만 명시).
--
-- 이중 안전장치로 구현한다 — Supabase 요금제/리전에 따라 pg_cron이 기본 활성화가 아닐 수
-- 있어서다:
--   1) 여기서 pg_cron으로 매일 새벽 3시(UTC) 정리 함수를 스케줄링(가능하면 이게 1차 수단).
--   2) app/api/cron/cleanup-expired/route.ts + vercel.json의 Vercel Cron(매일 1회, 무료
--      티어에서도 사용 가능)이 같은 정리를 서버 코드로 한 번 더 수행 — pg_cron이 막혀 있어도
--      동작한다.
-- 두 경로가 같은 삭제 조건(30일)을 쓰므로 중복 실행돼도 안전(멱등)하다. SQL 함수를 고치면
-- route.ts의 삭제 로직(lib/db/cleanup.ts)도 같이 맞춰야 한다 — 스키마가 갈라지지 않게 주의.

create or replace function public.claudebridge_cleanup_expired_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.responses where created_at < now() - interval '30 days';
  delete from public.blocked_events where created_at < now() - interval '30 days';
  delete from public.usage_logs where recorded_at < now() - interval '30 days';
end;
$$;

comment on function public.claudebridge_cleanup_expired_records() is 'D 항목 30일 TTL 정리. app/api/cron/cleanup-expired과 동일 조건을 유지할 것.';

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'claudebridge-ttl-cleanup',
      '0 3 * * *',
      $cron$select public.claudebridge_cleanup_expired_records();$cron$
    );
  end if;
end;
$$;
-- pg_cron 확장이 이 Supabase 프로젝트에서 아직 활성화되지 않았다면 위 블록은 조용히
-- 건너뛴다(에러로 마이그레이션 전체를 막지 않기 위해) — 그 경우 Vercel Cron 경로가
-- 유일한 정리 수단이 되므로 vercel.json의 크론이 반드시 배포돼 있어야 한다.
