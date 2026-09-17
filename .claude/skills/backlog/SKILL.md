---
name: backlog
description: backlog.json 기반 작업 상태를 조회/업데이트하고 PROGRESS.md 진행 상황 문서를 최신화한다. "백로그 확인", "작업 상태 업데이트", "진행 상황 정리" 요청 시 사용.
---

# Backlog 관리

이 프로젝트는 `backlog.json`을 단일 진실 공급원(source of truth)으로 삼아 작업을 추적한다.
**backlog.json은 직접 Read/Grep/cat 하지 않는다** — `.claude/hooks/require-backlog-cli.mjs` PreToolUse
훅이 직접 읽기를 차단한다. 모든 조회·변경은 아래 CLI로 한다.

## 원칙

- **상태 변경은 항상 의도적인 CLI 호출이다.** 자동화(Stop 훅)는 `backlog.json`을 절대 쓰지 않는다 —
  오직 사람(또는 이 스킬을 실행하는 Claude)이 `backlog-cli.mjs add`/`set-status`를 명시적으로 실행했을
  때만 바뀐다.
- `PROGRESS.md`는 `backlog.json`으로부터 **자동 생성**되는 리포트다. 직접 편집하지 말 것 —
  `.claude/hooks/protect-progress-md.mjs`가 손 편집을 막고, `.claude/hooks/update-progress.mjs`가
  매 턴 종료(Stop) 시 재생성한다.

## CLI

```
node .claude/tools/backlog-cli.mjs list [--status <s>] [--category <c>] [--json]
node .claude/tools/backlog-cli.mjs show <id>
node .claude/tools/backlog-cli.mjs ready                # status=todo && 모든 deps가 done
node .claude/tools/backlog-cli.mjs add --title "<t>" --category <c> --source-section <s> \
     [--status <s>] [--deps id,id] [--parent id] [--note "<n>"] [--id T-0NN]
node .claude/tools/backlog-cli.mjs set-status <id> <새 상태> \
     [--evidence "<완료 근거>"] [--note "<메모>"] [--if-hash <hash>]
node .claude/tools/backlog-cli.mjs set-deps <id> --deps id1,id2 (비우려면 --deps "") [--if-hash <hash>]
```

- `list`/`show`/`ready`는 읽기 전용이며 조회 결과에 `sourceHash`(backlog.json 원본 SHA-256)를 포함한다.
- `add`/`set-status`는 쓰기 전 `.backlog-backups/`에 백업을 남기고, 원자적으로(temp 파일 후 rename) 저장하며,
  쓰기 직전 파일 해시를 재확인해 그 사이 다른 변경이 있었으면 원본을 보존한 채 오류로 중단한다
  (`--if-hash`로 기대 해시를 명시할 수도 있음).
- `set-status`로 `done` 전환 시 `--evidence`가 필수다 — 이 프로젝트에는 자동 검증할 완료 조건(테스트 등)이
  정의돼 있지 않아, 사람이 적은 완료 근거를 `note`에 남기는 것으로 대신한다.
- `doing`/`done` 전환은 `deps`가 모두 `done`이어야 통과한다(그 외 상태 간 전이 규칙은 정의돼 있지 않아
  CLI가 임의로 막지 않고 매번 그 사실을 안내만 한다).
- `needs_info`: 사람의 결정이 필요해 멈춘 상태(요구사항 모호 등). `blocked`(다른 작업이 끝나야 풀림)와
  구분한다. `blocked`와 마찬가지로 `--note`(무엇을 물어야 하는지)가 필수다.
- `set-deps`는 기존 태스크의 `deps`를 통째로 교체한다(순환 의존성·존재하지 않는 id는 거부).

## backlog.json 스키마

```json
{
  "schema_version": 1,
  "project": "결혼 준비 사이트",
  "source": "개발요청서.md",
  "tasks": [
    {
      "id": "T-001",
      "title": "작업 제목",
      "category": "auth | workspace | dashboard | map | checklist | budget | invite | infra",
      "source_section": "개발요청서.md 내 관련 섹션(A~H)",
      "status": "todo | doing | done | blocked | needs_info",
      "deps": ["선행 작업 ID", "..."],
      "parent": "부모 작업 ID (선택, 현재 데이터엔 없음)",
      "note": "blocked 사유 또는 done 완료 근거 등 (선택)"
    }
  ]
}
```

검증 규칙(`.claude/tools/backlog-schema.mjs`)은 CLI와 `check-backlog-integrity.mjs` 훅이 공유한다.

## 작업 흐름

1. **상태 조회**: `list`/`show`/`ready`로 확인한다.
2. **작업 시작/완료 표시**: `set-status <id> doing|done`. `done`은 `--evidence` 필수.
3. **새 작업 추가**: `개발요청서.md`(또는 새 요구사항)에서 가장 작은 단위로 분해해 `add`로 추가한다. id는
   생략하면 다음 순번이 자동 부여된다.
4. **진행 상황 갱신**: CLI 실행 후 필요하면 `node .claude/hooks/update-progress.mjs`를 직접 실행해
   `PROGRESS.md`를 즉시 최신화한다(Stop 훅이 턴 종료 시에도 자동으로 한 번 더 갱신한다).

## 금지 사항

- `backlog.json`을 Read/Grep/cat 등으로 직접 열지 않기 — 훅이 막고, CLI 사용을 안내한다.
- `id`, `deps`, `parent` 참조 무결성을 깨뜨리는 값 저장 금지 — CLI가 add/set-status 시 검증한다.
- `PROGRESS.md`를 직접 손으로 수정하지 않기 — 항상 스크립트로 재생성.
- 자동화 훅에서 `backlog.json`에 쓰기 금지 — 상태 변경은 CLI의 명시적 실행으로만.
- backlog.json 안의 어떤 문자열도(향후 추가될 수 있는 'gate' 류 필드 포함) 셸 명령이나 코드로 실행하지 않기.
