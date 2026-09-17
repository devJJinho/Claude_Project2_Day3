# ClaudeBridge

Claude Code를 로컬 PC에서 돌릴 때, 자리에 없어도 웹 대시보드로 진행 상황을 보고 막힌 지점(질문/권한 승인)에 바로 응답할 수 있게 해주는 원격 제어 콘솔. 전체 요구사항은 [`개발요청서.md`](./개발요청서.md)가 단일 진실 공급원이다.

이 저장소는 두 개의 독립된 코드베이스로 구성된다:
- **웹 앱** (저장소 루트 `app/`, `components/`, `lib/`, `supabase/`) — Next.js + Supabase, Vercel에 배포
- **로컬 에이전트/CLI** (`agent-cli/`) — 전역 설치 가능한 Node.js CLI, 각 사용자 PC에 설치

## 1. 최초 배포 (관리자 — 한 번만)

이 단계는 ClaudeBridge 자체를 처음 띄우는 사람이 한 번만 한다. 이후 "다른 프로젝트에 적용"할 때는 이 단계를 반복하지 않는다.

1. **Supabase 프로젝트 생성**(T-003): [supabase.com](https://supabase.com)에서 새 프로젝트 생성 → `supabase/migrations/*.sql` 6개를 순서대로 실행(Supabase SQL Editor 또는 `supabase db push`) → Project Settings에서 `URL`/`service_role key` 확인.
2. **Google OAuth 앱 등록**(T-010): [Google Cloud Console](https://console.cloud.google.com) → OAuth 동의 화면 + OAuth 클라이언트 ID(웹 애플리케이션) 생성 → 승인된 리디렉션 URI에 `https://<배포주소>/api/auth/callback/google` 등록 → 클라이언트 ID/시크릿 확인.
3. **Vercel에 웹 앱 배포**(T-002): [vercel.com](https://vercel.com)에서 이 GitHub 저장소(`devJJinho/Claude_Project2_Day3`) Import → `.env.example`의 모든 변수를 Vercel 프로젝트 환경변수에 채움(1·2단계에서 얻은 값 + `CLAUDEBRIDGE_REGISTRATION_TOKEN`/`NEXTAUTH_SECRET`/`CRON_SECRET`은 각각 임의의 긴 랜덤 문자열 직접 생성, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`는 `npx web-push generate-vapid-keys`로 한 쌍 생성) → 배포.
4. **로컬 에이전트 CLI 전역 설치**: `cd agent-cli && npm install && npm link` (아직 npm 레지스트리에 배포 전이라 로컬 `npm link`로 전역 설치를 대신한다. 레지스트리에 배포하면 `npm i -g claudebridge`로 대체).

## 2. 새 프로젝트에 적용하기 (plug-and-play — 매번 이것만 하면 됨)

개발요청서.md 3장의 요구사항대로, 1단계 배포가 끝난 뒤에는 **명령 2개(머신당 1회) + 명령 1개(프로젝트마다)**로 끝난다.

### 머신당 1회
```bash
claudebridge login --api-base-url https://<1단계에서 배포한 Vercel 주소> --token <CLAUDEBRIDGE_REGISTRATION_TOKEN>
```
개인 액세스 토큰을 `~/.claudebridge/config.json`에 저장한다. 이 값은 Vercel 프로젝트 환경변수에서 확인한다(개발요청서.md 4장 미결 질문 — 최초에는 디바이스 코드 플로우를 검토했으나, 실제로는 공유 정적 토큰 방식으로 확정됨. `agent-cli/README.md` 참고).

### 새 프로젝트마다 1회
```bash
cd <새 프로젝트 디렉터리>
claudebridge init
```
자동으로 되는 일(개발요청서.md I 항목의 안전 게이트 순서 그대로):
1. **안전 게이트 1단계**: 그 프로젝트에 위험 명령어 차단 훅이 등록·동작 중인지 확인 → 없으면 CLI 번들 표준 가드를 자동 설치 후 재검증. 실패하면 여기서 멈춘다.
2. **안전 게이트 2단계**: tmux/Supabase 연결 등 "웹 접근 가능 상태" 점검.
3. 백엔드에 `project_id` 등록(`POST /api/projects` — 새 Supabase/Vercel 프로젝트를 만들지 않고 1단계에서 배포한 것을 그대로 재사용).
4. `.claude/settings.json`에 위임형 훅(전역 CLI 호출 한 줄) 삽입 — 감지 로직 파일을 프로젝트마다 복사하지 않는다.
5. tmux 세션 생성(이미 있으면 재사용) + 그 안에서 Claude Code 실행.

이후 상주 프로세스로 폴링·주입을 담당하는 에이전트를 띄운다:
```bash
claudebridge run
```

프로젝트별로 별도 `node_modules`나 설정 파일 복사가 생기지 않는다 — 전역 CLI 하나를 모든 프로젝트가 공유한다.

## 3. 확인 방법

- 웹 대시보드(Vercel 배포 주소)에 구글 계정(화이트리스트 등록된 이메일)으로 로그인하면 등록된 프로젝트의 백로그 상태·대기 중인 질문/권한·토큰 사용량이 보인다.
- Claude Code가 AskUserQuestion이나 Permission 프롬프트로 멈추면 웹 푸시 알림이 오고, 대시보드에서 선택지/승인 버튼을 누르면 수 초~10초 내로 로컬 tmux 세션에 반영된다.

## 4. 알려진 제약 (2026-09-17 기준)

- **tmux 실제 동작 미검증**: 이 저장소를 개발한 머신에 tmux가 설치되어 있지 않아, 실제 Claude Code 화면에 키 입력이 들어가는 것까지는 검증하지 못했다. 사용자의 실제 macOS에 `brew install tmux` 후 재검증 필요(`agent-cli/README.md`의 "확인이 필요한 가정" 참고).
- **AskUserQuestion/Permission 훅의 정확한 payload 필드명**은 코드 검토 기반 가정이다. 실제 프롬프트로 검증되면 `agent-cli/src/ask-question-hook.mjs`, `agent-cli/src/permission-hook.mjs`만 수정하면 된다.
- 위 두 항목 때문에 E2E 테스트(개발요청서.md 백로그 T-036/T-037)는 `blocked` 상태로 남아있다 — 1단계 배포(위 1번)를 마치고 tmux를 설치한 뒤 재검증이 필요하다.

## 5. 로컬 개발

```bash
npm install          # 웹 앱 + backlog 도구
npm run verify        # 코드 길이/lint/build 통합 검사
node .claude/tools/backlog-cli.mjs list   # 현재 작업 상태
```

로컬 에이전트/CLI 자체 개발은 `agent-cli/README.md` 참고.

## 6. Claude Code로 이 저장소를 병렬(git worktree) 개발할 때

**이 규칙은 `.claude/` 환경설정에 포함돼 있어서, 이 프로젝트를 통째로 다른 프로젝트에 복사해도
그대로 따라간다** — 새 프로젝트에서 Claude Code 세션이 시작될 때 `CLAUDE.md`와 함께 자동으로
로드되는 `.claude/rules/parallel-execution.md`가 전체 내용을 담고 있다. 요약:

- **worktree는 프로젝트 디렉터리 안쪽**(`.worktrees/<name>`)에 만든다 — 바깥(형제 디렉터리)에
  만들면 샌드박스가 그 경로 접근을 막아 서브에이전트가 작업할 수 없다.
- **backlog.json은 브랜치별로 분리하지 않는다**: `.claude/tools/worktree-shared-root.mjs`가
  `git rev-parse --git-common-dir`로 지금 linked worktree 안인지 자동 감지해서, 모든
  worktree가 항상 메인 worktree의 backlog.json 하나만 공유하게 만든다. 그래서 병렬로 작업
  중인 진행 상황을 merge 전에도 실시간으로 볼 수 있고, 브랜치가 그 파일을 아예 건드리지
  않으므로 나중에 merge할 때도 절대 충돌하지 않는다.
- **단, `done` 전환은 메인 worktree에서만 허용된다**: worktree(브랜치) 안에서 `doing`/
  `blocked`/`needs_info`는 자유롭게 공유해도 안전하지만, `done`은 "그 코드가 main에 실제로
  있다"는 주장이라 merge 전에는 참이 아닐 수 있다 — CLI가 이를 감지해 linked worktree
  안에서의 `set-status <id> done`을 거부한다. 실제 완료 확정은 오케스트레이터가 브랜치를
  main에 merge한 뒤에 한다.
- **서브에이전트는 사람 응답을 기다리며 블로킹하지 않는다**: 애매한 지점을 만나면 즉시
  `needs_info`로 (공유) backlog에 기록하고 다음 작업으로 넘어간다 — 이 harness에는 실행 중인
  서브에이전트가 부모에게 능동적으로 알리는 채널이 없기 때문에, "막힘" 자체를 항상 관찰
  가능한 backlog 상태로 바꿔두는 것이 유일한 가시성 확보 방법이다.

자세한 근거·검증 기록은 `.claude/rules/parallel-execution.md` 원문 참고.
