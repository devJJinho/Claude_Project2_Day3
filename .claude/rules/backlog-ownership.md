# backlog.json 변경 주체

각 항목 끝에 실제 적용 방식을 표시한다: `[hook]`=`.claude/settings.json`에 등록된 훅이 기술적으로 검사/차단, `[지침]`=Claude가 읽고 스스로 따르는 것일 뿐 기술적 강제 없음, `[리뷰]`=subagent가 확인.

## 변경 주체

- `backlog.json`은 오직 `node .claude/tools/backlog-cli.mjs`의 `add` / `set-status` / `set-deps`로만 바꾼다. Edit/Write로 직접 고치지 않는다.
  - 직접 Read/Grep/Bash(cat, jq, sed -i, `>` 리디렉션, cp 등)로 읽거나 쓰는 시도는 `.claude/hooks/require-backlog-cli.mjs`(PreToolUse: Read|Grep|Bash|Edit|Write)가 차단한다. **[hook]**
  - 이 훅은 완전한 보안 경계가 아니다(휴리스틱 패턴 매칭 — 임의 우회까지 다 막지는 못함, 훅 파일 상단 주석 참고). 우회하지 않는다는 것 자체는 **[지침]**.
- `add`/`set-status`/`set-deps`는 실행 전 스키마 검증(`.claude/tools/backlog-schema.mjs`), 실행 전 백업(`.backlog-backups/`), 쓰기 직전 해시 재확인, 원자적 저장(temp+rename)을 자동으로 한다. **[hook 수준 — CLI 코드 자체에 내장, 우회 불가]**
- 자동화 훅(Stop 훅 `update-progress.mjs` 등)은 `backlog.json`에 절대 쓰지 않는다 — 읽기만 한다. **[hook — 코드에 쓰기 로직 자체가 없음]**

## 동시 실행(subagent 병렬 실행) 중 규칙

- `critical-reviewer`(`.claude/agents/critical-reviewer.md`)는 도구가 Read/Grep/Glob뿐이라 애초에 아무것도 못 쓴다. **[hook — 에이전트 정의의 tools 제한]**
- `backlog-explainer`(`.claude/agents/backlog-explainer.md`)는 Read/Write를 갖지만 산출물은 `docs/backlog/*.md`로 한정한다. **이 제한 자체는 [지침]** — Write 도구가 있어 기술적으로는 다른 파일도 쓸 수 있음을 유의.
- 두 subagent 실행 중에는 **메인만** `backlog.json`을 갱신한다. subagent에게는 고정된 스냅샷(버전/해시 포함)을 프롬프트로 전달하고, 그 사이 메인은 같은 입력을 바꾸지 않는다. **[지침]**
- subagent 결과를 합친 뒤 실제로 수정이 필요하면, 그 시점에 메인이 CLI로 반영한다(근거 있는 지적만 — `status-transition.md` 참고).
