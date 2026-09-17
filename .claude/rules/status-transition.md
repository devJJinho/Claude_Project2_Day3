# 상태 전이 규칙

태그 의미는 `backlog-ownership.md` 참고.

## 허용 상태

`todo` / `doing` / `done` / `blocked` / `needs_info` (`.claude/tools/backlog-schema.mjs`의 `VALID_STATUS`). 이 다섯 값 밖의 문자열은 `set-status`가 거부한다. **[hook — CLI 및 `check-backlog-integrity.mjs`가 공유 검증]**

- `blocked`: 다른 작업이 끝나야 풀리는 상태. `note`에 보류 사유 필수. **[hook]**
- `needs_info`: 사람의 판단/답변이 필요해 멈춘 상태(요구사항 모호, 선택지 확인 등). `note`에 무엇을 물어야 하는지 필수. **[hook]** 사람 결정이 필요한 지점을 만나면 임의로 추정해 진행하지 말고 이 상태로 남긴다. **[지침]**
- `doing`/`done` 진입: `deps`가 전부 `done`이어야 한다. **[hook]**
- `done` 진입: `--evidence`(완료 근거) 필수 — `note`에 기록된다. **[hook]**
- 그 외 상태 간 전이 순서(예: `todo`→`done` 직행 허용 여부)는 정의돼 있지 않다. CLI가 막지 않고 그 사실을 매번 출력만 한다 — 임의로 규칙을 만들어 강제하지 않는다. **[지침]**

## 완료 근거로 인정하지 않는 것

다음은 그 자체로 `done` 전환의 근거가 될 수 없다. `--evidence`에는 실제로 확인한 사실을 적는다:

- subagent 리뷰를 아직 돌리지 않은 상태
- `npm run verify`(length/lint/build) 중 하나라도 실패한 상태
- 검사가 **NOT_CONFIGURED**로 나온 상태(예: 도구가 아직 설치·설정되지 않음) — 이 경우 통과로 적지 말고 실제로 설정한 뒤 재실행한다
- "아마 될 것"이라는 추정

**[지침 — CLI는 evidence 문자열의 내용까지는 검증하지 않는다. 사람/Claude가 스스로 지킨다.]**

## needs_info 운영

- 사람의 결정이 필요하면 `set-status <id> needs_info --note "<질문>"`으로 남기고, 작업을 진행하지 않는다.
- 사용자가 답하면, 그 결정을 `note`에 반영해 원래 진행 가능한 상태(`todo`/`doing`)로 되돌린다.

**[지침]**
