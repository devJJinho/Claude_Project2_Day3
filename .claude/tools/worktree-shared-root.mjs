// git worktree 환경에서 backlog.json을 "브랜치가 아니라 공유 상태"로 취급하기 위한 공통 경로
// 해석 로직. .claude/rules/parallel-execution.md 참고.
//
// 왜 필요한가: git worktree는 backlog.json을 포함한 모든 추적 파일을 브랜치별로 완전히
// 분리한다. 그래서 병렬 작업 중인 worktree는 서로의 backlog.json 변경을 merge 전까지 볼 수
// 없다 — 이는 이 프로젝트가 만들려는 ClaudeBridge 자체의 목표(원격에서 실시간으로 상태를 본다)
// 와 정면으로 모순된다. 해결책은 backlog.json을 애초에 브랜치 분리 대상에서 빼는 것이다:
// 모든 worktree가 "메인 worktree의 backlog.json" 딱 하나만 바라보게 만들면(기본 동작으로,
// 사람이 매번 --file을 기억할 필요 없이), 각 브랜치의 backlog.json은 체크아웃 시점 그대로
// 얼어붙어 있으므로 나중에 merge할 때 그 파일에서는 diff 자체가 없어 충돌이 원천적으로
// 발생하지 않는다.
//
// 탐지 방법: `git rev-parse --git-common-dir`는 메인 worktree에서는 상대경로(".git")를,
// linked worktree에서는 메인 저장소의 실제 .git 절대경로를 돌려준다(git 자체 기능 — worktree
// 여러 개가 하나의 .git을 공유하는 구조를 그대로 이용). 이 경로의 부모 디렉터리가 "공유 루트"
// (메인 worktree의 최상위)다. git이 없거나 실패하면(예: git 저장소가 아닌 테스트 환경) 안전하게
// 원래 경로로 폴백한다 — 이 함수는 절대 예외를 던지지 않는다.

import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * @param {string} fallbackRoot 이 스크립트가 원래(worktree 분리 이전) 쓰던 프로젝트 루트
 * @returns {string} 공유해야 할 실제 프로젝트 루트(메인 worktree). 실패 시 fallbackRoot.
 */
export function getSharedProjectRoot(fallbackRoot) {
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: fallbackRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!commonDir) return fallbackRoot;
    const resolvedCommonDir = path.resolve(fallbackRoot, commonDir);
    return path.dirname(resolvedCommonDir);
  } catch {
    return fallbackRoot;
  }
}
