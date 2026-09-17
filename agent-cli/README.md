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

## 확인이 필요한 가정(여전히 남음 — 실제 Claude Code TUI를 tmux로 붙여 검증 필요)

이 환경은 비대화형 백그라운드 세션이라 tmux 위에서 실제 Claude Code를 띄워 AskUserQuestion/
Permission 프롬프트 화면을 눈으로 확인할 방법이 없었다(이 머신에는 tmux 자체도 설치돼 있지
않다 — `brew list tmux` 확인). 아래는 web-app과의 계약과 무관하게 **Claude Code 자체의
동작**에 대한 가정이며, 실제 화면으로 검증되면 해당 파일만 고치면 된다:

1. **AskUserQuestion tool_input 스키마** (`src/ask-question-hook.mjs`의 `extractPayload`):
   `{ questions: [{ question, header, options: [{label, description}] }] }` 형태로 가정.
   다중 질문(questions.length > 1) 동시 응답은 1차 구현 범위 밖 — 첫 질문만 처리한다.
2. **Notification 훅으로 Permission 프롬프트를 감지할 수 있다는 가정**
   (`src/permission-hook.mjs`): 범용 `Notification` 훅의 메시지 텍스트에서 "permission"/
   "권한" 문구와 도구 이름만 정규식으로 추출한다 — `command`/`description`은 Notification
   메시지만으로는 알 수 없어 빈 값으로 남는다(알려진 한계, 파일 상단 주석 참고).
3. **선택지/승인 응답의 정확한 키 입력** (`src/key-mapping.mjs`): AskUserQuestion은 "숫자
   입력 후 Enter", Permission(approve/deny)은 "1=approve/2=deny 후 Enter"로 가정했다.
   Claude Code의 실제 권한 프롬프트가 3옵션(예/항상 예/아니오)이면 deny의 위치가 다를 수
   있다. 화이트리스트 검증 구조(모르는 값은 예외) 자체는 이 가정과 무관하게 유효하다.
4. **tmux 세션 재사용 정책**(개발요청서.md 4장 미결 질문, 확정): `claudebridge init`은 같은
   project_id의 세션이 이미 있으면 재사용하고, 새로 만들었을 때만 Claude Code를 자동
   실행한다(`src/tmux-session.mjs`) — 중복 프로세스 실행을 피하기 위한 결정.
5. **tmux 자체가 이 개발 환경에 없다**: `tmux-session.mjs`/`tmux-inject.mjs`의 tmux 명령
   구성(인자 배열 기반, shell 미사용)은 코드 검토·부재 감지(isTmuxAvailable 등)까지만
   실측했고, 실제 세션 생성·send-keys 성공 여부는 tmux가 설치된 환경(사용자의 실제 macOS)
   에서 재검증이 필요하다.

## 완료된 작업 (T-013~T-022, T-029~T-031, T-033, T-039, T-041~T-047, 총 22건)

모두 `done` 처리되었다 — web-app 트랙 merge(커밋 `189b064`) 이후 실제 계약에 맞춰
재작성하고, 위 목 서버 통합 테스트로 검증했다. 남은 라이브 미검증 항목(tmux 실제 동작,
Claude Code 훅 payload 정확한 필드명)은 이 파일의 "확인이 필요한 가정"에 모아뒀다 —
실제 Supabase 프로젝트 생성(`T-003`)과 tmux 설치 후 재검증을 권장한다.
