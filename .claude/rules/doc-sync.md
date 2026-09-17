# 문서 갱신 시점 · 경로 · 조건

태그 의미는 `backlog-ownership.md` 참고.

## PROGRESS.md

- 경로: 프로젝트 루트 `PROGRESS.md`.
- 갱신 시점/조건: 매 턴 종료(Stop) 시 자동. 조건 없이 항상 최신 `backlog.json`으로 재생성됨.
- 방법: `node .claude/hooks/update-progress.mjs` (Stop 훅에 등록). **[hook]**
- 직접 손으로 고치지 않는다 — `.claude/hooks/protect-progress-md.mjs`(PreToolUse: Edit|Write)가 차단한다. **[hook]**

## docs/backlog/T-0NN.md (작업별 설명 문서)

- 경로: `docs/backlog/<id>.md`. `backlog-explainer` subagent(`.claude/agents/backlog-explainer.md`)가 생성.
- 갱신 조건: 해당 태스크가 포함된 `backlog.json` 스냅샷의 `sourceHash`가 문서 상단에 적힌 것과 달라졌을 때. 문서 자체에 기준 스냅샷 해시와 그 시점의 status를 남기도록 정의돼 있다 — 문서 존재 여부와 실제 작업 완료 여부를 혼동하지 않는다. **[지침 — subagent 프롬프트에 명시, 강제 훅 없음]**
- 갱신 시점: `backlog.json`이 실제로 바뀐 뒤(주로 6단계: 결과 병합·수정 반영 이후), 필요할 때 `backlog-explainer`를 다시 실행. 매 턴 자동 실행은 아니다.
- 대시보드(`dashboard/index.html`)의 각 작업 상세 패널에 `../docs/backlog/<id>.md` 링크가 있다 — id 패턴으로만 만든 고정 경로이며 실제 파일 유무와 무관하게 항상 노출된다(없으면 브라우저가 열기 실패로 보여줌). **[지침]**

## 대시보드에서 최신 상태 확인

- `backlog.json`이 바뀐 뒤에는 대시보드에서 "다시 불러오기" 버튼으로 재조회하거나(항상 가능), File System Access API를 지원하는 환경(`http://localhost` 등, `file://`는 미지원)에서는 자동 새로고침(라디오 "켜짐")으로 확인한다. **[지침 — 대시보드는 읽기 전용 뷰어일 뿐 자동 알림 훅은 없음]**
- 대시보드가 보여주는 `SHA-256`이 CLI `list --json`의 `sourceHash`와 같아야 같은 버전을 보고 있는 것이다.

## CLAUDE.md / rules

- `CLAUDE.md`와 `.claude/rules/*.md`(이 문서 포함)는 요구사항·백로그 데이터가 아니라 "일하는 방식"만 담는다. `backlog.json` 내용을 여기 복사하지 않는다 — 항상 CLI로 조회한다.
- 이 규칙 파일들은 Claude Code가 세션 시작 시 CLAUDE.md와 같은 우선순위로 자동 로드한다(`paths` frontmatter 없는 `.claude/rules/*.md`는 무조건 로드). 단, 이번 세션 중간에 만든 파일이라 **다음 세션부터** 확실히 적용된다 — 이번 세션 안에서는 hooks/subagent와 같은 재로딩 지연이 있을 수 있다. **[hook 아님 — 컨텍스트로만 제공, 도구 호출을 기술적으로 막지 않음. 실제 차단은 hooks/permissions만 함]**
