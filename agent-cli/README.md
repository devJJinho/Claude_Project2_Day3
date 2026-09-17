# claudebridge (로컬 에이전트/CLI)

ClaudeBridge의 로컬 상주 에이전트 겸 전역 설치 CLI. `개발요청서.md`의 A(연동 아키텍처),
B(막힌 상황 범위), H(설치 형태), I(보안·안전 게이트) 항목을 구현한다.

## 설치 및 사용

```
npm i -g claudebridge          # 머신당 1회
claudebridge login             # 머신당 1회 — 개인 액세스 토큰 발급(디바이스 코드 플로우)
cd <프로젝트 디렉터리>
claudebridge init               # 프로젝트마다 1회
claudebridge run                # 로컬 상주 에이전트(폴링+주입) — 별도 터미널/프로세스로 상주
```

## 안전 게이트 (가장 중요한 제약)

`claudebridge init`과 `claudebridge run` 모두 시작하자마자 `boot-sequence.mjs`를 통해
1단계(위험 명령어 차단 훅이 실제로 동작하는지 self-test) → 2단계(tmux/Supabase 연결 점검)
순서를 강제한다. 1단계가 실패하면 2단계 함수 자체를 호출하지 않는다. 1단계가 처음부터
실패하면 `safety-gate-install.mjs`가 CLI 표준 가드(`claudebridge hook guard`, 로직은
`guard-hook-logic.mjs` — 이 저장소의 `.claude/hooks/block-dangerous-commands.mjs`를
그대로 이식)를 `.claude/settings.json`에 자동 등록하고 재검증한다. Permission 응답 주입
(`tmux-inject.mjs`의 `injectPermissionDecision`)은 호출될 때마다 1단계를 다시 확인하고,
통과하지 못하면 아무것도 하지 않는다.

## 웹 앱(다른 트랙)과의 계약 가정 — 통합 시 반드시 맞춰볼 것

이 트랙은 web-app 트랙(별도 worktree)이 구현할 백엔드/DB를 직접 만들지 않는다. 아래는
로컬 에이전트 코드가 "이런 형태일 것"이라고 가정하고 작성한 계약이다. 실제 구현이 다르면
해당 파일만 고치면 되도록 계약을 한 곳(`src/schema-contract.mjs`)과 API 호출부
(`src/login-command.mjs`, `src/init-command.mjs`)에 모아뒀다.

### Supabase 테이블 (`src/schema-contract.mjs`)
- `projects`: project_id 확장 설계(G 항목)의 기준 테이블.
- `blocked_events(id, project_id, kind, status, payload jsonb, created_at, answered_at)`
- `responses(id, blocked_event_id, project_id, kind, value jsonb, consumed bool, created_at)`
- `usage_logs(project_id, session_id, request_id, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, occurred_at)` — `(project_id, request_id)` 유니크 가정(upsert 사용).
- `push_subscriptions(endpoint, keys jsonb)` — 로컬 에이전트는 읽기만 함.

### 백엔드 REST API
- `POST /api/cli/device-code` → `{ device_code, verify_url, expires_in, interval }`
- `GET /api/cli/device-code/:device_code` → `{ status: "pending" | "approved" | "expired" | "denied", token? }`
- `POST /api/projects` (`Authorization: Bearer <personal access token>`, body `{ name, localPath }`)
  → `{ project_id, dashboard_url }` — 같은 `localPath`로 재호출하면 기존 project_id를 멱등하게 반환한다고 가정.

### 로컬 환경변수(서비스 롤 키는 파일에 저장하지 않음 — I 항목)
- `CLAUDEBRIDGE_SUPABASE_URL`, `CLAUDEBRIDGE_SUPABASE_SERVICE_ROLE_KEY`
- `CLAUDEBRIDGE_VAPID_PUBLIC_KEY`, `CLAUDEBRIDGE_VAPID_PRIVATE_KEY`, `CLAUDEBRIDGE_VAPID_SUBJECT`
- `CLAUDEBRIDGE_API_BASE_URL`, `CLAUDEBRIDGE_DASHBOARD_URL` (login 시 `~/.claudebridge/config.json`에도 저장)

## 확인이 필요한 가정(라이브 Claude Code 세션으로 검증 전)

이 환경에는 tmux로 Claude Code를 실제로 띄워 AskUserQuestion/Permission 프롬프트가 뜬
화면을 캡처해 정확한 키 입력 규칙을 확인할 방법이 없었다(비대화형 백그라운드 세션). 아래는
그래서 "합리적으로 가정하고 남긴" 부분이며, 실제 화면으로 검증되면 아래 파일만 고치면 된다:

1. **AskUserQuestion tool_input 스키마** (`src/ask-question-hook.mjs`의 `extractPayload`):
   `{ questions: [{ question, header, options: [{label, description}] }] }` 형태로 가정.
   다중 질문(questions.length > 1) 동시 응답은 1차 구현 범위 밖 — 첫 질문만 처리한다.
2. **Notification 훅으로 Permission 프롬프트를 감지할 수 있다는 가정**
   (`src/permission-hook.mjs`): Claude Code에 AskUserQuestion처럼 Permission 전용 훅
   이벤트가 별도로 없다고 보고, 범용 `Notification` 훅의 메시지 텍스트에서
   "permission"/"권한" 문구와 도구 이름을 정규식으로 추출한다.
3. **선택지/승인 응답의 정확한 키 입력** (`src/key-mapping.mjs`): AskUserQuestion은
   "숫자 입력 후 Enter", Permission은 "1=허용/2=항상 허용/3=거부 후 Enter"로 가정했다.
   화이트리스트 검증 구조(모르는 값은 예외) 자체는 이 가정과 무관하게 유효하다.
4. **tmux 세션 재사용 정책**(개발요청서.md 4장 미결 질문): `claudebridge init`은 같은
   project_id의 세션이 이미 있으면 재사용하고, 새로 만들었을 때만 Claude Code를 자동
   실행한다(`src/tmux-session.mjs`) — 중복 프로세스 실행을 피하기 위한 결정.
5. **개인 액세스 토큰 발급 방식**(개발요청서.md 4장 미결 질문): 디바이스 코드 플로우로
   결정(`src/login-command.mjs` 상단 주석에 근거 기술) — CLI가 OAuth를 직접 구현하지 않고
   이미 필요한 구글 로그인(C 항목)에 위임한다.

## 왜 아직 `done`이 아닌 백로그 항목이 있는가

이 트랙이 의존하는 Supabase 테이블(T-005~T-008, T-011 Google 로그인, T-032 push 구독,
T-040 등록 API)은 다른 worktree(web-app 트랙)의 소관이며, 이 저장소에는 실제 Supabase
프로젝트 자체도 아직 없다(T-003이 `needs_info`). 그래서 Supabase/백엔드에 직접 의존하는
모듈(`blocked-events.mjs`, `responses-poller.mjs`, `usage-logs.mjs`, `push-sender.mjs`,
`init-command.mjs`, `login-command.mjs`와 이들에 의존하는 훅들)은 **코드는 완성**했지만
**실제 테이블/엔드포인트로 검증은 못했다** — 백로그에는 이 상태를 `blocked`로 정직하게
남겼다(근거 없이 `done`으로 표시하지 않음). 네트워크·tmux 없이 검증 가능한 순수 로직
(`guard-hook-logic.mjs`, `key-mapping.mjs`, `log-parser.mjs`, `settings-writer.mjs`,
`safety-gate-stage1.mjs`)은 `scripts/smoke-test.mjs`로 실제로 돌려 확인했다
(`npm run smoke-test`) — T-029는 이 머신의 실제 `~/.claude/projects/**/*.jsonl` 파일을
읽어 179건의 실제 토큰 사용량 레코드를 뽑아내는 것까지 확인했다.
