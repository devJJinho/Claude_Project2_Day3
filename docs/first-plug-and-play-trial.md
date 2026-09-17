# 첫 plug-and-play 적용 기록: Day_4_Project

- 대상: `../Day_4_Project`(결혼 준비 사이트 — 이 저장소와 무관한 별도 프로젝트, `.claude` 환경설정만 같은 계보)
- 날짜: 2026-09-17
- 목적: 개발요청서.md 3장에서 설계한 "명령 2개(머신당 1회) + 명령 1개(프로젝트마다)"가 실제로 되는지 첫 실전 검증

## 사전 조건

- `Day_4_Project`는 이미 `.claude/hooks/block-dangerous-commands.mjs`가 등록되어 있었음(같은 `.claude` 계보를 공유하는 프로젝트라 안전 게이트 1단계를 위한 별도 설치가 필요 없는 자연스러운 테스트 조건).
- ClaudeBridge 백엔드는 이미 실배포 상태(`https://claude-project2-day3.vercel.app`, Supabase 프로젝트 `dvturgcufzzpnuvwdgnv`).

## 진행 순서와 실제 결과

### 1. 전역 CLI 설치
```bash
cd agent-cli && npm install && npm link
```
→ `/opt/homebrew/bin/claudebridge`로 전역 설치 성공, `claudebridge --help` 정상 출력.

### 2. `claudebridge login` — 1차 시도 실패, 버그 발견

```bash
claudebridge login --api-base-url https://claude-project2-day3.vercel.app --token <TOKEN>
```
결과:
```
claudebridge 오류: 백엔드(Vercel) 배포 주소를 알 수 없습니다. --api-base-url <url> 로 지정하거나 CLAUDEBRIDGE_API_BASE_URL 환경변수를 설정하세요.
```

**원인(실제 버그, `agent-cli/bin/claudebridge.mjs`)**: `dispatch()`가 `const [command, sub, ...rest] = argv`로 두 번째 토큰을 무조건 `sub`로 떼어냈다. 이건 `hook <name>`(guard/ask-question/permission)에만 필요한 위치 인자인데, `login`/`init`/`run`에는 두 번째 토큰이 `sub`가 아니라 첫 플래그(`--api-base-url`)다 — 그래서 그 플래그가 통째로 사라지고 나머지(`--token`)만 파싱됐다.

**수정**: `command === "hook"`일 때만 `sub`를 떼어내고, 그 외 커맨드는 `command` 다음 토큰 전부를 `parseFlags`로 넘기도록 분기를 나눔(`agent-cli/bin/claudebridge.mjs`). `agent-cli/scripts/smoke-test.mjs` 및 `npm run verify` 재통과 확인 후 계속 진행.

### 3. `claudebridge login` — 재시도 성공
```bash
claudebridge login --api-base-url https://claude-project2-day3.vercel.app --token <TOKEN>
```
```
로그인 완료 — 등록 토큰이 ~/.claudebridge/config.json에 저장되었습니다(권한 600).
```
`~/.claudebridge/config.json`(권한 600) 확인:
```json
{
  "apiBaseUrl": "https://claude-project2-day3.vercel.app",
  "registrationToken": "<REDACTED>",
  "dashboardUrl": "https://claude-project2-day3.vercel.app",
  "projects": {}
}
```

### 4. `claudebridge init` (Day_4_Project 안에서) — 1차 시도 실패, 설계 갭 확인

```bash
cd ../Day_4_Project && claudebridge init
```
```
[1단계 통과] 훅이 위험 명령을 차단함을 확인: node .claude/hooks/block-dangerous-commands.mjs
claudebridge 오류: [안전 게이트 2단계 실패] supabase: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.
```

**이건 버그가 아니라 의도된 보안 설계**: 개발요청서.md I 항목("서비스 롤 키는 로컬 환경변수에만 보관")에 따라 `agent-cli/src/config.mjs`가 서비스 롤 키를 `~/.claudebridge/config.json`에 **의도적으로 저장하지 않는다** — 매번 환경변수로만 읽는다. 다만 README의 "머신당 1회" 설명에 이 env var export 단계가 빠져 있었다(문서 갭). 실제로는:
```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
```
를 셸 프로파일(`~/.zshrc` 등)에 한 번 넣어두는 것도 "머신당 1회" 설정의 일부여야 한다.

### 5. `claudebridge init` — 재시도 성공 (env var를 같은 셸에서 export 후)

```
[1단계 통과] 훅이 위험 명령을 차단함을 확인: node .claude/hooks/block-dangerous-commands.mjs
[2단계 통과] tmux/Supabase 연결 확인 완료
[등록 완료] project_id=clb_899dd247a17148dcbc99
[훅 등록 완료] .claude/settings.json에 claudebridge 위임형 훅 3종 삽입
[세션 생성] 새 tmux 세션(claudebridge-clb_899dd247a17148dcbc99)에서 Claude Code 실행

완료: 대시보드에서 확인하세요 -> https://claude-project2-day3.vercel.app
```

**검증한 것**:
- `Day_4_Project/.claude/settings.json`에 기존 훅(protect-progress-md, block-dangerous-commands, require-backlog-cli 등)을 건드리지 않고 위임형 훅 3개만 추가됨을 확인:
  - `PreToolUse` 배열에 `claudebridge hook guard`, `claudebridge hook ask-question` 추가
  - `Notification`에 `claudebridge hook permission` 추가
- `tmux list-sessions`로 `claudebridge-clb_899dd247a17148dcbc99` 세션 생성 확인
- `tmux capture-pane`으로 그 세션 안에서 실제 Claude Code가 `Day_4_Project` 디렉터리를 열고 정상 대기 중임을 확인(프로젝트가 이미 신뢰된 상태라 trust 프롬프트 없이 바로 대기 화면으로 진입)

## 발견 사항 정리

| 항목 | 유형 | 처리 |
|---|---|---|
| `claudebridge.mjs`의 인자 파싱이 `login`/`init`/`run`의 첫 플래그를 삼킴 | **실제 버그** | 코드 수정 완료, 테스트 갱신, 커밋 예정 |
| SUPABASE_URL/SERVICE_ROLE_KEY를 머신에 export해야 한다는 안내 누락 | 문서 갭 | README "머신당 1회" 절에 보강 필요(아래 후속 작업) |
| 위험 명령어 차단 훅이 이미 있으면 1단계가 그냥 통과함 | 설계대로 동작 | 해당 없음 |
| 기존 `.claude/settings.json` 훅을 안 건드리고 위임형 훅만 추가됨 | 설계대로 동작 | 해당 없음 |

## 후속 작업

- [x] README.md "2. 새 프로젝트에 적용하기 — 머신당 1회"에 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 셸 프로파일 export 단계 추가 완료
- [x] `claudebridge run` 데몬 실제 기동 완료 — 진행 중 pane 프로세스 감지 버그(pane_current_command가 "claude"/"node"가 아니라 버전 문자열로 나옴)도 발견해 수정

## 추가 발견 및 기능 확장 (데몬 기동 이후)

데몬을 실제로 띄운 뒤 사용자가 `Day_4_Project`에서 직접 개발을 시작하면서 두 가지 실제 요청이 들어왔고, 둘 다 바로 이 실전 적용 과정에서 드러난 진짜 갭이었다:

1. **"backlog.json 내용이 웹에서 안 보인다"**: 개발요청서.md 원문(1장)은 "웹에서 백로그/진행률 확인"을 요구했는데, T-024 구현 당시 실제로는 `blocked_events` 이벤트 카운트로 대체 구현되어 있었다(스코프 누락). → `project_backlog_snapshot` 테이블 신설, 로컬 에이전트가 30초 주기로 대상 프로젝트의 backlog.json을 그대로 동기화, `/dashboard/backlog` 페이지 신설. 실제로 `Day_4_Project`의 50개 태스크가 대시보드에 그대로 뜨는 것까지 확인.
2. **"토큰 사용량을 /status 잔여량으로"**: 기존 입력/출력 토큰 집계(T-028)는 유지하면서, tmux로 실제 Claude Code에 `/status`를 띄워 "이번 세션 %/이번 주 %" 잔여량을 긁어오는 기능 추가(`usage_quota` 테이블). 이 스크래핑은 사용자가 실제로 쓰는 pane에 개입하므로, 생성 중이거나 입력 중이면 건너뛰는 안전장치를 넣었다 — 실제로 사용자가 세션을 쓰는 동안 데몬을 재기동했더니 이 안전장치가 정확히 발동해 건너뛰는 것을 실측 확인했다.

두 기능 모두 Supabase 마이그레이션 적용 → 코드 작성(`npm run verify` + `smoke-test.mjs` 14건 전체 통과, 실제 `next build`로도 재확인) → 커밋/푸시 → Vercel 자동 재배포(Ready) → 데몬 재기동까지 마치고, 실제 배포된 `https://claude-project2-day3.vercel.app/dashboard/backlog`·`/dashboard/usage`에서 스크린샷으로 최종 확인했다.

## 실전 사용 중 발견한 감지 누락 사례 조사 (2026-09-17)

사용자가 `Day_4_Project`에서 실제 개발을 진행하던 중 "확인 필요" 상황이 발생했는데
대시보드의 "대기 질문·권한" 탭에 뜨지 않는 것을 목격해 조사를 시작했다.

**조사 경로**: Supabase `blocked_events`를 직접 조회 → 해당 프로젝트에 아무 기록도 없음(표시
버그가 아니라 기록 자체가 안 됨) → tmux 세션의 실제 `claude` 프로세스(PID) 환경변수에
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`가 정상적으로 있음을 확인 → `PATH`에도
`claudebridge`가 설치된 `/opt/homebrew/bin`이 포함되어 있음을 확인 → 두 가설 모두 기각.

**실측 진단**: `stdin-json.mjs`에 `CLAUDEBRIDGE_HOOK_DEBUG` 임시 진단 로그를 추가하고,
실제 세션에서 `AskUserQuestion`을 직접 유발시켜 Claude Code가 훅에 실제로 보내는 원본
stdin을 그대로 캡처했다:
- PreToolUse(AskUserQuestion) payload는 가정과 거의 일치(`tool_input.questions[0].{question,
  header, options:[{label,description}]}`) — 이 경로는 실제로 정상 동작했다(주입까지 확인:
  "파란색" 선택 → Claude Code 화면에 그대로 반영됨).
- Notification(permission) payload의 `message`는 가정했던 `"Claude needs your permission to
  use <Tool>"`가 아니라 그냥 **`"Claude needs your permission"`**이었다(도구 이름 없음) — 다만
  이건 크래시로 이어지지 않고 기존 코드가 이미 `tool: "unknown"`으로 정상 처리한다(README의
  "알려진 한계"대로).

**진짜 원인은 따로 있었다 — auto mode에서 대화상자가 이미 사라진 뒤 응답이 주입됨**: 두
이벤트 모두 실제로는 Supabase에 정상 기록됐고(`status: pending`), 사용자가 대시보드에서
직접 응답한 것도 확인됐다(`responses` 테이블에 `responded_by`로 실제 이메일 기록). 문제는
`permission_mode: "auto"`(자동 진행 모드)인 세션에서는 Permission Notification 훅은 뜨지만
화면상 실제 대화형 승인/거부 프롬프트 없이 Claude Code가 알아서 넘어가 버린다는 점이다 —
그 상태에서 웹 응답(`approve`)을 그대로 tmux에 주입하니 이미 사라진 프롬프트가 아니라
**다음 자유 입력줄에 숫자 "1"이 그대로 타이핑**되어 Claude가 엉뚱한 텍스트로 받아들이는
것을 실측으로 확인했다(`⏺ "1"이 어떤 맥락인지 명확하지 않습니다...`).

즉 사용자가 원래 보고한 "감지 자체가 안 된다"는 재현되지 않았다(이 라이브 테스트 시점
기준으로는 감지·기록·표시·응답까지 전부 정상 동작) — 대신 이번 조사로 **더 근본적인 위험**
(대화상자가 없는데 키를 주입해 세션을 오염시키는 문제)을 실측으로 새로 발견했다.

**수정**: `tmux-inject.mjs`에 `isPermissionDialogShowing`/`isAskUserQuestionDialogShowing`을
추가해, 주입 직전에 pane을 캡처하고 실제로 그 대화상자가 화면에 떠 있는지 확인한다. 없으면
`DialogNotShowingError`를 던져 아무 키도 보내지 않는다. `daemon.mjs`의 `dispatchResponse`는
이 에러를 "이미 다른 방식으로 끝난 상태"로 간주해 조용히 넘어가고(재시도하지 않음 — 다시
나타날 리 없는 대화상자를 5초마다 영원히 재시도하는 것을 방지), 그 외 에러는 그대로
던져 기존 at-least-once 재시도 정책을 유지한다. `smoke-test.mjs`에 실측 캡처 텍스트 기반
테스트 2건을 추가해 총 16건 전체 통과 확인, `npm run verify` + `next build` 재확인 완료.
진단용 임시 로그(`CLAUDEBRIDGE_HOOK_DEBUG`)는 기본값을 꺼짐으로 되돌리고 캡처된 로그
파일은 삭제했다(민감한 tool_input 내용이 평소에 디스크에 남지 않도록).
