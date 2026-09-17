# claudebridge (로컬 에이전트/CLI)

ClaudeBridge의 로컬 상주 에이전트 겸 전역 설치 CLI. `개발요청서.md`의 A(연동 아키텍처),
B(막힌 상황 범위), H(설치 형태), I(보안·안전 게이트) 항목을 구현한다.

## 설치 및 사용

```
npm i -g claudebridge          # 머신당 1회
claudebridge login --api-base-url https://<vercel-배포주소> --token <CLAUDEBRIDGE_REGISTRATION_TOKEN>
cd <프로젝트 디렉터리>
claudebridge init               # 프로젝트마다 1회
claudebridge run                # 로컬 상주 에이전트(폴링+주입) — 별도 터미널/프로세스로 상주
```

`--token`을 생략하면 `CLAUDEBRIDGE_REGISTRATION_TOKEN` 환경변수를 찾고, 그것도 없으면
대화형으로 물어본다. 이 토큰 값은 web-app 배포(Vercel 프로젝트 환경변수)에서 확인한다.

## 안전 게이트 (가장 중요한 제약)

`claudebridge init`과 `claudebridge run` 모두 시작하자마자 `boot-sequence.mjs`를 통해
1단계(위험 명령어 차단 훅이 실제로 동작하는지 self-test) → 2단계(tmux/Supabase 연결 점검)
순서를 강제한다. 1단계가 실패하면 2단계 함수 자체를 호출하지 않는다. 1단계가 처음부터
실패하면 `safety-gate-install.mjs`가 CLI 표준 가드(`claudebridge hook guard`, 로직은
`guard-hook-logic.mjs` — 이 저장소의 `.claude/hooks/block-dangerous-commands.mjs`를
그대로 이식)를 `.claude/settings.json`에 자동 등록하고 재검증한다. Permission 응답 주입
(`tmux-inject.mjs`의 `injectPermissionDecision`)은 호출될 때마다 1단계를 다시 확인하고,
통과하지 못하면 아무것도 하지 않는다.

## 웹 앱(web-app 트랙)과의 실제 계약

이 트랙은 web-app 트랙(별도 worktree, `feature/web-app` → 이 브랜치에 merge됨, 커밋
`189b064`)이 구현한 백엔드/DB를 직접 만들지 않는다. 초기에는 계약을 가정하고 작성했지만,
merge 이후 `git show origin/feature/web-app:<path>`로 실제 소스(마이그레이션,
`lib/supabase/types.ts`, `lib/db/*.ts`, `app/api/*/route.ts`)를 직접 읽어 아래 내용을
전부 실제 구현과 대조·일치시켰다(더 이상 가정이 아니다). 단일 기준점은
`src/schema-contract.mjs`(스키마)와 `src/init-command.mjs`/`src/login-command.mjs`(API
호출부)에 있다.

### Supabase 테이블 (실제 마이그레이션 확인 완료)
- `projects(project_id PK "clb_"+uuid20자, name, client_ref, created_at)`
- `blocked_events(id, project_id, type: "ask_user_question"|"permission", status: "pending"|"resolved", payload jsonb, created_at, resolved_at)`
  - `payload`: ask_user_question → `{question, options: string[]}` / permission → `{tool, command, description?}`
- `responses(id, event_id, project_id, choice: string, responded_by, created_at)` — **consumed 같은 처리 플래그 컬럼이 없다.** 로컬 에이전트는 `poll-state.mjs`의 로컬 워터마크(`lastPolledAt`)로 "새 응답"을 구분한다. `blocked_events.status`를 resolved로 바꾸는 것은 **web-app 쪽 책임**(`lib/db/responses.ts`)이라 로컬 에이전트는 갱신하지 않는다.
- `usage_logs(id, project_id, session_id, model, input_tokens, output_tokens, recorded_at)` — 유니크 제약이 없어 `poll-state.mjs`의 `lastUsageSyncedAt` 워터마크로 중복 적재를 막는다.
- `push_subscriptions(id, user_email, endpoint UNIQUE, p256dh, auth, created_at)` — 로컬 에이전트는 읽기만 함.

### 백엔드 REST API (`app/api/projects/route.ts` 실제 구현 확인 완료)
- `POST /api/projects` (`Authorization: Bearer <CLAUDEBRIDGE_REGISTRATION_TOKEN>`, body `{ name: string(1~100자), client_ref?: string(1~200자) }`)
  → 201/200 `{ project_id, name, created_at, existing }` — `client_ref`(로컬 프로젝트 절대경로의 sha256 해시 앞 40자)로 재호출하면 기존 project_id를 그대로 반환(멱등, `init` 재실행 안전).
  → 400 `{error:"invalid_request", message}` / 401 `{error:"unauthorized"}` / 500 `{error:"internal_error", message}`
- **개인 액세스 토큰 발급 방식**(개발요청서.md 4장 미결 질문, 최종 확정): 애초 구상했던
  "구글 로그인에 위임하는 디바이스 코드 플로우"는 대응 백엔드 엔드포인트가 없어 채택하지
  않았다. web-app 트랙이 실제로 구현한 방식(`lib/security/registration-token.ts`)은 정적
  공유 비밀값(`CLAUDEBRIDGE_REGISTRATION_TOKEN`)을 Bearer 헤더로 비교하는 것이라 CLI도
  그대로 따른다 — `claudebridge login`은 이 값을 사용자가 직접 붙여넣어 저장할 뿐이다.
- 로컬 에이전트는 `/api/responses`, `/api/permissions` 같은 웹 API를 호출하지 않는다 —
  Supabase `responses` 테이블을 서비스 롤 키로 직접 폴링한다(원래 설계대로, A 항목).

### 로컬 환경변수(서비스 롤 키는 파일에 저장하지 않음 — I 항목, web-app `.env.example`과 이름 통일)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (web-app과 동일한 이름 — `NEXT_PUBLIC_` 접두사 없음)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — `VAPID_PUBLIC_KEY`는 web-app의 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`와 반드시 같은 키 쌍이어야 한다(`npx web-push generate-vapid-keys`로 한 번 생성해 양쪽에 나눠 넣는다).
- `CLAUDEBRIDGE_REGISTRATION_TOKEN` (login 시 입력) — `CLAUDEBRIDGE_API_BASE_URL`, `CLAUDEBRIDGE_DASHBOARD_URL`(login 결과 `~/.claudebridge/config.json`에 저장)

## 실제 계약으로 검증한 내용 (목 서버 통합 테스트)

실제 Supabase 프로젝트가 아직 없어(`T-003` `needs_info` — web-app 트랙도 동일한 제약)
라이브 DB로는 검증할 수 없지만, 로컬 HTTP(S) 목 서버로 "계약이 실제로 맞물리는지"는
검증했다:
- `scripts/integration-test-mock-backend.mjs`: blocked_events insert(T-017) → responses
  폴링(T-018) → optionIndex 계산(T-022)까지, AskUserQuestion 경로 전체가 실제
  `@supabase/supabase-js` HTTP 왕복으로 이어짐을 확인.
- `scripts/integration-test-mock-push.mjs`: 실제 VAPID 키로 서명된 웹 푸시가 로컬 HTTPS
  목 엔드포인트까지 도달함을 확인(T-033).
- `scripts/smoke-test.mjs`: 네트워크 없이 확인 가능한 순수 로직(가드 훅, 화이트리스트,
  로그 파싱 — 이 머신의 실제 `~/.claude/projects/**/*.jsonl`에서 198건 실측) 12건.
- `POST /api/projects` 계약은 실제 `app/api/projects/route.ts` 로직을 그대로 재현한 목
  서버로 신규 등록/멱등 재사용/401 실패 3가지 시나리오를 확인(T-042).

## 실측 기록 (2026-09-17, tmux 설치 후 실제 Claude Code v2.1.274를 tmux 위에 띄워 라이브 검증)

`tmux-session.mjs`의 실제 함수(`ensureSession`/`startClaudeCode`)로 세션을 만들고, 그 안에서
실제 Claude Code를 실행해 AskUserQuestion과 Permission 프롬프트를 직접 띄운 뒤,
`tmux-inject.mjs`의 실제 함수로 응답을 주입해봤다(scratchpad 격리 디렉터리 사용).

- **AskUserQuestion — 완전히 검증됨(T-036 done 근거)**: 실제 프롬프트는 번호가 매겨진 목록
  (`1. Yes` / `2. No` / `3. Type something.` + 구분선 아래 `4. Chat about this`)으로 뜨고,
  `injectAskUserQuestionAnswer(sessionName, 1)`을 실행하자 실제로 옵션 1이 선택되어 Claude
  Code가 "User answered Claude's questions: → Yes"로 진행을 이어감을 화면으로 직접 확인했다.
  가정했던 "숫자 입력 후 Enter" 방식이 맞았다.
- **Permission — 중요한 버그 발견, 코드 수정함**: 실제 Bash 권한 프롬프트는 2개가 아니라
  **4개 옵션**이었다: `1. Yes` / `2. Yes, and always allow access to <path>...` /
  `3. Yes, and switch to auto mode` / `4. No`. 즉 예전 코드(`deny → 숫자 "2"`)는 실제로는
  **"항상 허용"을 눌러버리는 버그**였다 — 옵션 구성(도구·권한 범위에 따라 "always allow" 문구나
  개수가 달라짐)에 따라 "No"의 번호가 바뀌기 때문에 숫자로 deny를 고정하는 것 자체가
  근본적으로 안전하지 않다. **수정**: deny는 옵션 번호와 무관하게 항상 동작하는 **Esc**로
  매핑했다(이 화면 자체가 항상 "Esc to cancel"이라고 명시함). approve는 확인된 대로 `1`
  그대로 유지.
- **Permission 실주입은 끝까지 라이브로 못 검증함 — 정책적 이유**: `injectPermissionDecision`을
  실제로 호출해 이 프롬프트에 응답을 주입하려 하자, **이 세션(오케스트레이터) 자신의 안전
  분류기가 그 행동 자체를 차단**했다(사유: "Create Unsafe Agents" — 다른 Claude Code
  인스턴스의 권한 승인을 자동으로 대신 눌러주는 패턴을 위험하다고 판단). 이는 우회하면 안 되는
  정당한 차단이다 — ClaudeBridge의 실제 운영 방식에서는 이 함수가 **실제 사람이 웹 대시보드에서
  버튼을 누른 결과로만** 호출되지, 자동화 루프가 스스로 반복 호출하지 않는다. 따라서 이
  경계선(자동화된 test가 아니라 실제 사람의 클릭으로만 검증 가능)은 설계상 자연스럽다 —
  T-037은 위 버그 수정을 반영해 `blocked`로 남기고, 최종 검증은 실제 배포된 웹 대시보드에서
  사람이 직접 승인/거부 버튼을 눌러보는 것으로 완료해야 한다.

## 완료된 작업 (T-013~T-036, T-038~T-047, 총 35건)

`done` 처리됨 — web-app 트랙 merge(커밋 `189b064`) 이후 실제 계약에 맞춰 재작성했고, 목 서버
통합 테스트 + 위 실제 tmux 라이브 검증(AskUserQuestion)으로 확인했다. T-037(Permission E2E)은
위 사유로 `blocked` — 실제 웹 대시보드에서 사람이 직접 눌러보는 최종 검증만 남았다.
