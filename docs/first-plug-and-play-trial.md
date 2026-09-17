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

- [ ] README.md "1. 최초 배포" 또는 "2. 새 프로젝트에 적용하기 — 머신당 1회"에 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 셸 프로파일 export 단계 추가
- [ ] `Day_4_Project`에 남겨둔 tmux 세션(`claudebridge-clb_899dd247a17148dcbc99`)을 계속 켜둘지, `claudebridge run` 데몬을 실제로 띄워서 대시보드에서 실시간 승인까지 끝까지 테스트해볼지는 사용자 확인 후 진행
