// 안전 게이트 1단계 실패 시 자동 복구(T-045): CLI가 보증하는 표준 위험 명령어 차단 훅을
// 자동 설치하고 재검증한다. "설치"란 로직 파일을 프로젝트에 복사하는 게 아니라(H 항목 원칙),
// hook-delegate-template.mjs의 guard 항목(`claudebridge hook guard` 한 줄)을
// .claude/settings.json에 등록하는 것이다 — 실제 판정 로직은 이 CLI 패키지의
// guard-hook-logic.mjs 하나뿐이라 프로젝트마다 사본이 생기지 않는다.
//
// 사용자가 이미 자기 프로젝트에 동등한 훅(이 저장소의 block-dangerous-commands.mjs 같은)을
// 직접 만들어 둔 경우는 stage1 최초 검증에서 이미 통과하므로 이 함수까지 오지 않는다 — 여기는
// "훅이 아예 없거나 동작하지 않을 때"만 CLI 표준 훅으로 보강하는 경로다.
import { checkStage1GuardActive } from "./safety-gate-stage1.mjs";
import { installHooks } from "./settings-writer.mjs";
import { buildHooksToInstall } from "./hook-delegate-template.mjs";

/**
 * @param {string} projectDir 대상 프로젝트 루트
 * @returns {{passed: boolean, reason: string, installed: boolean}}
 */
export function ensureStage1GuardOrInstall(projectDir) {
  const initial = checkStage1GuardActive(projectDir);
  if (initial.passed) return { passed: true, reason: initial.reason, installed: false };

  installHooks(projectDir, buildHooksToInstall(["guard"]));

  const revalidated = checkStage1GuardActive(projectDir);
  if (revalidated.passed) {
    return {
      passed: true,
      reason: `CLI 표준 훅(claudebridge hook guard)을 자동 설치한 뒤 재검증 통과: ${revalidated.reason}`,
      installed: true,
    };
  }
  return {
    passed: false,
    reason:
      `CLI 표준 훅을 설치했지만 재검증에 실패했습니다(${revalidated.reason}). ` +
      `claudebridge가 PATH에 없거나 실행 권한 문제일 수 있습니다 — 수동으로 'claudebridge hook guard'를 실행해 원인을 확인하세요.`,
    installed: true,
  };
}
