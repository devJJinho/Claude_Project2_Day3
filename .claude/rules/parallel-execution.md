# 병렬 실행 정책과 git worktree 절차

태그 의미는 `backlog-ownership.md` 참고.

## 기본 원칙: 토큰 효율 > 병렬화

**병렬로 처리 가능하다는 사실 자체가 병렬로 처리해야 한다는 뜻은 아니다.** 이 프로젝트는 1인
사이드 프로젝트이고, 병렬 에이전트/worktree를 새로 띄우는 데는 항상 비용이 있다 —
컨텍스트를 처음부터 다시 유도해야 하고(개발요청서.md, CLAUDE.md, 관련 backlog 태스크를 다시
읽어야 함), 병합 시점에 통합 검증(`npm run verify`)을 한 번 더 해야 한다. 30분 단위로 쪼갠
태스크 2~4개짜리 vertical을 위해 별도 세션을 새로 여는 것은 대부분 이 비용이 병렬 이득보다
크다. **[지침]**

병렬 worktree는 아래 조건을 모두 만족할 때만 고려한다:
1. 대상 작업들이 backlog 의존성상 서로 blocking 관계가 아니다(`ready` 명령으로 동시에 후보로
   뜬다).
2. 서로 다른 파일/디렉터리를 건드릴 것으로 예상된다(아래 "파일 충돌 위험" 참고).
3. 실제로 시간(며칠 단위 작업량)을 절약할 만큼 작업량이 충분하거나, 사용자 본인이 한 vertical을
   직접 병행 작업하려는 경우다.

## 현재 backlog(T-001~T-050) 의존성 분석

`node .claude/tools/backlog-cli.mjs list --json`의 `deps`를 기반으로 계산한 결과(2026-09-17):

- **임계 경로(critical path)**: 9단계, 8개 엣지 —
  `T-001 → T-003 → T-007 → T-008 → T-027 → T-028 → T-029 → T-032 → T-034/T-035`
  (프로젝트 초기화 → Supabase 연결 → workspace/candidate 스키마 → 후보 등록 API/UI → 상세
  화면 → 알림·실시간). 이 체인은 병렬화해도 전체 완료 시간이 줄지 않는다 — 순서대로만 갈 수
  있다.
- **레이어 1(가장 이른 병렬 후보)**: `T-002`(Tailwind), `T-003`(Supabase 연결), `T-004`(Vercel
  연결), `T-024`(추천 카테고리 상수), `T-039`(네이버지도 키) — 서로 다른 설정 파일을 건드려
  파일 충돌 위험이 낮다.
- **레이어 2의 소셜로그인 3종(`T-013`/`T-014`/`T-015`)**: backlog상 서로 deps가 없어 "병렬
  가능"으로 보이지만, 구현 시 세 provider를 같은 설정 파일(예: `lib/auth/providers.ts`
  하나)에 몰아 넣으면 병렬 작업 시 충돌한다. **권장**: provider별로 파일을 분리해서 구현할 것
  (`lib/auth/providers/google.ts`, `kakao.ts`, `naver.ts`) — 병렬 여부와 무관하게 좋은
  구조이고, 이렇게 하면 병렬 작업도 안전해진다.
- **infra DB 스키마 태스크(`T-005`~`T-011`)**: Supabase 마이그레이션 컨벤션(타임스탬프
  파일명이 자동 부여되는 `supabase migration new`)을 따르면 태스크마다 별도 파일이 생겨
  파일 충돌 없이 병렬 가능하다.
- **독립적인 4개 vertical(가장 안전한 worktree 후보)**: `map`(T-039~042), `checklist`
  (T-043~044), `dday`(T-045~046), `budget`(T-047~048) — 서로 다른 테이블·컴포넌트·라우트를
  쓰고 서로를 참조하지 않는다. 단, 각각 선행 조건(`T-001`, 그리고 `T-009`/`T-010`/`T-011`)이
  끝나야 시작 가능하고, `map`의 마지막 태스크(`T-042`)만 `dashboard`(T-036)와 만난다.
- **auth/workspace 내부**: 같은 vertical 안에서 순차 의존성이 강해 자체적으로는 병렬화 여지가
  거의 없다 — 직렬로 진행하는 게 자연스럽다.

**결론**: 지금 시점에 4개 독립 vertical(총 10개 태스크, 약 5시간 분량)을 위해 별도 worktree
세션을 여는 것은 위 "기본 원칙"에 따라 권장하지 않는다. 사용자가 직접 한 vertical을 병행
작업하고 싶을 때, 또는 향후 태스크가 훨씬 커질 때 아래 절차를 쓴다.

## git worktree 병렬 실행 절차 (필요해졌을 때)

1. **worktree 생성**: `git worktree add ../Day_4_Project-map -b feature/map` (vertical별로
   브랜치 이름 통일 — `feature/<vertical>`).
2. **node_modules 중복 설치 방지**: `.claude/settings.json`(또는 사용자 설정)에
   `"worktree": {"symlinkDirectories": ["node_modules"]}`를 추가해두면 새 worktree가 기존
   `node_modules`를 심볼릭 링크로 재사용한다 — `npm install`을 매번 새로 돌리지 않아도 됨
   (시간·디스크 절약).
3. **범위를 좁게 지시**: 해당 worktree의 세션에는 "이 worktree에서는 T-039~T-042(map)만
   진행"처럼 관련 태스크 id만 명시한다 — 50개 전체 backlog 컨텍스트를 다시 설명하지 않아도
   `CLAUDE.md`/`개발요청서.md`는 worktree에도 그대로 체크아웃되어 있으므로 자동으로 로드된다.
4. **각 worktree는 독립적으로 체크포인트한다**: `auto-checkpoint.mjs`(commit-cadence.md)가
   worktree마다 자신의 브랜치를 기준으로 주기적 커밋+푸시를 한다(상태 파일이 worktree별로
   분리돼 있어 서로 간섭하지 않음).
5. **병합**: 작업이 끝나면 `git checkout main && git merge feature/map`.
   - 코드 파일은 vertical별로 디렉터리가 분리돼 있다면 대부분 자동 병합된다.
   - **`backlog.json`/`PROGRESS.md` 충돌은 손으로 병합하지 않는다** — `backlog.json`은
     태스크마다 블록이 분리된 JSON이라 서로 다른 태스크를 건드렸다면 git이 보통 자동 병합하고,
     실제 충돌이 나면 두 브랜치가 같은 태스크를 건드렸다는 뜻이므로 `backlog-cli.mjs
     set-status`로 최종 상태를 다시 명시적으로 반영하는 편이 안전하다(원자적 쓰기·해시 검증을
     다시 거치게 됨). `PROGRESS.md`는 애초에 생성물이므로 충돌 여부와 무관하게 병합 후
     `node .claude/hooks/update-progress.mjs`로 재생성한다.
6. **통합 검증**: 병합 직후 `npm run verify`를 한 번 더 돌린다 — 각 worktree에서 개별적으로
   통과했더라도, 합쳤을 때(예: 카테고리 상수 파일에 새 항목이 겹치는 등) 새로운 lint/길이
   문제가 생길 수 있다.
7. **정리**: `git worktree remove ../Day_4_Project-map && git branch -d feature/map`.

## 이 저장소 훅과 worktree

`.claude/` 아래 모든 훅·규칙·도구는 커밋된 파일이라 worktree를 새로 만들면 그 시점의 브랜치
내용 그대로 함께 체크아웃된다 — `block-dangerous-commands.mjs`, `require-backlog-cli.mjs`
같은 안전장치는 worktree마다 별도 설정 없이 동일하게 적용된다. **[지침]**
