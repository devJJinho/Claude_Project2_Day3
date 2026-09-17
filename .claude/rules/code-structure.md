# 코드 구조 규칙

태그 의미는 `backlog-ownership.md` 참고.

## 파일 길이

소스 파일(`.claude/hooks/*.mjs`, `.claude/tools/*.mjs`, `dashboard/*.js` — `.claude/tools/quality-config.mjs`의 `SOURCE_DIRS`/`SOURCE_EXTENSIONS`) 300줄 기준. 초과 시 압축·의미 없는 분할이 아니라 책임 단위로 나눈다. **[hook — PostToolUse `quick-quality-check.mjs`(편집 직후 해당 파일), Stop `full-quality-check.mjs`(전체)]**

## 책임 분리 (이미 적용된 실제 사례)

- backlog CLI: 조회(`backlog-queries.mjs`) / 변경(`backlog-mutations.mjs`) / 진입점·라우팅(`backlog-cli.mjs`) / 검증·해시(`backlog-schema.mjs`) / 오류 타입(`backlog-errors.mjs`)로 분리.
- 대시보드: 상태·파싱·검증(`dashboard-core.js`) / 목록·진행률·새로고침 표시(`dashboard-render.js`) / 상세 패널(`dashboard-detail.js`)로 분리.
- 새 코드를 추가할 때도 "읽기/쓰기/진입점" 또는 "상태/렌더링" 같은 실제 책임 경계를 먼저 찾고, 그 경계를 따라 파일을 나눈다. **[지침 — 훅은 줄 수만 재고 책임 분리의 타당성은 판단하지 않는다]**

## lint / build

- lint: `node_modules/.bin/oxlint --deny-warnings`(경고도 실패로 취급 — 기본값은 경고를 통과시키므로 반드시 이 플래그 포함). **[hook]**
- build: 이 스택(Node ESM 스크립트, 번들러 없음)엔 산출물 생성 단계가 없다 — 전체 소스 `node --check`(문법 검사)로 대체한다. **[hook — `check-build.mjs`]**
- 종합 실행: `npm run verify` (`check:length` → `lint` → `build` 순).
- 도구가 없으면 NOT_CONFIGURED로 남기고 통과로 처리하지 않는다 — `status-transition.md`의 "완료 근거로 인정하지 않는 것" 참고.

## 데이터 실행 금지

`backlog.json` 안의 어떤 문자열도(예: `gate` 같은 필드) 셸 명령이나 코드로 실행하지 않는다 — 표시만 한다. **[지침 — 관련 코드(CLI, hooks, 대시보드) 전체가 이 원칙으로 작성돼 있으나, 새 코드를 추가할 때 스스로 지켜야 함]**
