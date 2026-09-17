# 병렬 실행 정책과 git worktree 절차

태그 의미는 `backlog-ownership.md` 참고.

## 기본 원칙: 토큰 효율 > 병렬화

**병렬로 처리 가능하다는 사실 자체가 병렬로 처리해야 한다는 뜻은 아니다.** 병렬 worktree를
새로 띄우는 데는 항상 비용이 있다 — 컨텍스트를 처음부터 다시 유도해야 하고, 병합 시점에
통합 검증(`npm run verify`)을 한 번 더 해야 한다. **[지침]**

병렬 worktree는 아래 조건을 모두 만족할 때만 고려한다:
1. 대상 작업들이 backlog 의존성상 서로 blocking 관계가 아니다.
2. 서로 다른 디렉터리/코드베이스를 건드릴 것으로 예상된다(파일 충돌 위험이 낮음).
3. 실제로 시간을 절약할 만큼 작업량이 충분하다.

실제 사례(2026-09-17): ClaudeBridge 프로젝트를 "웹 앱"(Next.js, 저장소 루트)과 "로컬 에이전트
CLI"(`agent-cli/`)라는 서로 다른 코드베이스로 나눠 2개 worktree로 병렬 진행했다. 47개 작업을
각 서브에이전트에 개별로 맡기지 않고 코드베이스 경계 2개로만 나눈 것 자체가 "토큰 효율 >
병렬화" 원칙의 적용이다.

## backlog.json은 브랜치 분리 대상이 아니라 "공유 상태"다 — 반드시 지킬 것

**문제**: git worktree는 backlog.json을 포함한 모든 추적 파일을 브랜치별로 완전히 분리한다.
그래서 병렬로 작업 중인 worktree는 서로의(그리고 main의) backlog.json 변경을 merge 전까지
볼 수 없다. 이는 이 프로젝트가 만들려는 것(ClaudeBridge — 원격에서 실시간으로 작업 상태를
보는 도구) 자체의 목적과 정면으로 모순된다. 사람이 매번 `--file`을 기억해서 넘기는 방식은
잊어버리기 쉬워 안전하지 않다.

**해결**: `.claude/tools/worktree-shared-root.mjs`의 `getSharedProjectRoot()`가
`git rev-parse --git-common-dir`로 지금 linked worktree 안에 있는지 자동 감지해서,
**backlog.json의 기본 대상을 항상 메인 worktree의 backlog.json으로 고정**한다
(`backlog-cli.mjs`/`require-backlog-cli.mjs`/`update-progress.mjs` 전부 동일 로직 사용).
`--file`로 명시하면 그 값이 우선하지만, 평소에는 아무 worktree에서
`node .claude/tools/backlog-cli.mjs ...`를 그냥 실행하면 자동으로 공유된다. **[hook —
코드로 강제, 문서로만 안내하는 게 아님. 2026-09-17 실제 worktree 2개로 교차 검증 완료:
worktree에서 쓴 변경이 메인 backlog.json에 즉시 반영되고, worktree 자체의 backlog.json
파일은 git diff 하나 없이 그대로 유지됨을 확인.]**

이 설계 덕분에 브랜치의 backlog.json은 체크아웃 시점 그대로 얼어붙어 절대 바뀌지 않는다 —
따라서 나중에 그 브랜치를 main에 merge할 때 backlog.json에는 diff 자체가 없어 **충돌이
원천적으로 발생하지 않는다.**

## 그런데 공유만으로는 부족하다 — "done"은 merge된 코드에 대해서만 참이어야 한다

backlog.json을 공유하면 새로운 위험이 생긴다: worktree A에서 T-3 작업을 끝내고 backlog를
`doing → done`으로 바꿨는데, **그 브랜치를 아직 main에 merge하지 않았다면** — main의
backlog.json은 (공유 파일이니) T-3을 done이라고 말하지만, main의 실제 코드에는 T-3 구현이
없는 모순이 생긴다. worktree별로 backlog.json이 분리돼 있던 예전 방식에서는 이 모순이 생길
수 없었다(merge 전까지는 애초에 main의 backlog.json 자체가 안 바뀌었으므로) — 공유로
바꾸면서 새로 생긴 위험이다.

**해결**: `backlog-cli.mjs`가 실행 위치(자신의 실제 worktree 루트)와 공유 대상(메인 worktree
루트)이 다르면 `IS_LINKED_WORKTREE=true`로 판단하고, `set-status <id> done`을
`backlog-mutations.mjs`의 `cmdSetStatus`가 **거부**한다(`doing`/`blocked`/`needs_info`는
계속 허용 — 이 상태들은 "코드가 main에 존재한다"고 주장하지 않으므로 merge 여부와 무관하게
항상 참이다). **[hook — 코드로 강제. 2026-09-17 실제 worktree에서 doing은 성공, done은
거부되는 것을 확인.]**

실제 흐름:
1. worktree(서브에이전트)는 작업을 시작하면 `set-status <id> doing`(공유 backlog에 즉시 반영
   — 사용자가 지금 뭐가 진행 중인지 실시간으로 봄).
2. 작업을 마치면 **done으로 바꾸려 하지 말고** 완료 근거를 최종 보고(hand-back)에 적는다 —
   CLI가 어차피 거부하므로 시도해도 에러만 난다.
3. 오케스트레이터가 그 브랜치를 main에 **merge한 뒤**, 메인 worktree에서
   `set-status <id> done --evidence "..."`로 최종 확정한다.

## 사람의 결정이 필요한 지점 — 절대 블로킹하지 않는다

이 harness에는 "실행 중인 서브에이전트가 부모에게 능동적으로 메시지를 보내는" 채널이 없다.
부모가 먼저 확인하거나, 서브에이전트가 자기 턴을 끝낼 때(hand-back)만 결과가 전달된다. 그래서
서브에이전트가 사람의 판단이 필요한 애매한 지점에서 응답을 기다리며 멈추면, 그 "멈춤" 자체가
밖에서 보이지 않는다.

**규칙**: 서브에이전트는 사람의 결정이 필요한 지점을 만나면 절대 블로킹하지 말고, 즉시
`set-status <id> needs_info --note "<질문>"`으로 (공유) backlog에 기록하고 다음 ready 작업으로
넘어간다. **[지침 — CLI가 needs_info 상태 자체는 허용하지만 "블로킹하지 않고 넘어가는 행동"은
강제할 수 없음, 서브에이전트 프롬프트에 명시해야 함]**

이 규칙 + 위의 공유 backlog.json 덕분에, "webTree에서 뭘 하고 있는지, 어디서 막혔는지 밖에서
알 수 없다"는 문제가 구조적으로 해소된다 — 막힘이 곧 (실시간으로 보이는) needs_info 상태가
되기 때문이다.

## git worktree 실행 절차

1. **worktree 생성**: 항상 프로젝트 디렉터리 **안쪽**에 만든다(`.worktrees/<name>`, 이미
   `.gitignore` 처리됨) — 바깥(형제 디렉터리)에 만들면 이 harness의 sandbox가 그 경로로의
   접근을 차단해서 서브에이전트가 작업할 수 없다(2026-09-17 실제로 겪은 문제).
   ```
   git worktree add .worktrees/<name> -b feature/<name>
   ```
2. **의존성 설치**: 새 worktree에는 `node_modules`가 없다 — `npm install`을 한 번 해준다.
3. **서브에이전트 지시**: 프롬프트 첫 줄에 `cd .worktrees/<name>`부터 시키고, 상위 디렉터리나
   다른 worktree로 이동하거나 그 안의 파일을 건드리지 말라고 명시한다. 담당 backlog id 목록을
   명확히 좁혀서 준다(전체 백로그를 다시 설명할 필요는 없다 — `개발요청서.md`/`CLAUDE.md`는
   worktree에도 그대로 체크아웃돼 있어 자동으로 로드됨).
4. **완료마다 즉시 commit+push**: 작업 1건 끝날 때마다 그 worktree의 브랜치로 바로
   commit+push한다(15분 자동 체크포인트를 기다리지 않음 — 사용자가 명시적으로 요청한 지속
   규칙, `commit-cadence.md` 참고).
5. **병합**: 서브에이전트가 끝나면 오케스트레이터가 `git merge <branch>`로 main에 합친다.
   - 코드 파일은 디렉터리가 분리돼 있으면 대부분 자동 병합된다. 공유 도구 파일
     (`.claude/tools/quality-config.mjs` 등)처럼 양쪽이 같이 건드린 파일은 수동으로 두 변경을
     합친다(2026-09-17 실제로 `SOURCE_DIRS` 배열을 양쪽 합집합으로 병합).
   - **backlog.json은 위 설계 덕분에 항상 충돌 없이 자동 병합된다**(브랜치가 그 파일을 아예
     안 건드렸으므로) — 손으로 병합할 필요가 없다.
   - `PROGRESS.md`는 생성물이므로 병합 후 `node .claude/hooks/update-progress.mjs`로
     재생성한다.
   - merge 직후 이 시점에 비로소 `set-status <id> done --evidence "..."`으로 각 작업을
     확정한다.
6. **통합 검증**: 병합 직후 `npm run verify`를 한 번 더 돌린다 — 각 worktree에서 개별적으로
   통과했더라도 합쳤을 때 새 문제가 생길 수 있다.
7. **정리**: `git worktree remove .worktrees/<name> --force && git branch -d feature/<name>`.

## 이 저장소 훅과 worktree

`.claude/` 아래 모든 훅·규칙·도구는 커밋된 파일이라 worktree를 새로 만들면 그 시점의 브랜치
내용 그대로 함께 체크아웃된다 — `block-dangerous-commands.mjs`, `require-backlog-cli.mjs`
같은 안전장치는 worktree마다 별도 설정 없이 동일하게 적용된다. **단, 이 규칙 자체(backlog
공유·done 금지 로직)를 방금 바꿨다면, 그 커밋 이후에 만든 worktree부터 적용된다** —
커밋하지 않은 상태로 worktree를 만들면 새 로직이 없는 예전 코드가 체크아웃된다(2026-09-17
직접 겪은 실수). **[지침]**
