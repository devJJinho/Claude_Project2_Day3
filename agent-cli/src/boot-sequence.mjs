// 부팅 시퀀스(T-046): 안전 게이트 순서를 코드로 강제한다.
//   1단계(위험 명령어 차단 검증) 통과 → 그 다음에만 2단계(웹 접근 가능 상태 점검) 진행.
// 1단계가 끝내 실패하면 2단계는 아예 호출하지 않고 즉시 중단한다 — 개발요청서.md I 항목의
// "순서를 절대 건너뛰지 않는다"를 구조적으로 보장하기 위해, 이 함수 자체가 2단계 함수를
// 호출하는 유일한 경로가 되도록 만들고(daemon.mjs·init-command.mjs는 이 함수만 호출),
// 1단계 결과를 확인하기 전에는 2단계 함수(checkStage2WebAccess)를 참조조차 하지 않는다.
//
// "에이전트 재시작마다 매번 재검증"(개발요청서.md I 항목) 요구를 만족하기 위해 이 함수는
// 캐시하지 않는다 — 호출할 때마다 처음부터 다시 검사한다. daemon.mjs가 기동 시 한 번,
// 그리고 재시작될 때마다 다시 호출한다.
import { checkStage1GuardActive } from "./safety-gate-stage1.mjs";
import { ensureStage1GuardOrInstall } from "./safety-gate-install.mjs";
import { checkStage2WebAccess } from "./safety-gate-stage2.mjs";

/**
 * @param {string} projectDir
 * @param {string} tmuxSessionName
 * @returns {Promise<{
 *   passed: boolean,
 *   stage1: {passed:boolean, reason:string, installed?:boolean},
 *   stage2: {passed:boolean, checks:object}|null
 * }>}
 */
export async function runBootSequence(projectDir, tmuxSessionName) {
  const initialStage1 = checkStage1GuardActive(projectDir);
  const stage1 = initialStage1.passed ? initialStage1 : ensureStage1GuardOrInstall(projectDir);

  if (!stage1.passed) {
    // 1단계 실패 — 2단계는 절대 실행하지 않는다(함수 호출 자체를 하지 않음).
    return { passed: false, stage1, stage2: null };
  }

  const stage2 = await checkStage2WebAccess(tmuxSessionName);
  return { passed: stage2.passed, stage1, stage2 };
}

export function formatBootSequenceReport(result) {
  const lines = [];
  lines.push(`[1단계 위험 명령어 차단 검증] ${result.stage1.passed ? "통과" : "실패"} — ${result.stage1.reason}`);
  if (!result.stage2) {
    lines.push("[2단계 웹 접근 가능 상태 점검] 건너뜀(1단계 실패로 중단)");
    return lines.join("\n");
  }
  for (const [name, check] of Object.entries(result.stage2.checks)) {
    lines.push(`[2단계 - ${name}] ${check.ok ? "통과" : "실패"} — ${check.reason}`);
  }
  return lines.join("\n");
}
