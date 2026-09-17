// tmux send-keys로 웹 응답을 주입하는 함수(T-020: AskUserQuestion, T-021: Permission).
//
// 이 파일은 key-mapping.mjs가 만들어준 "이미 화이트리스트 검증을 통과한 키 목록"만 받는다 —
// 원시 문자열을 직접 받는 공개 함수는 두지 않는다(자유 텍스트 주입 경로 원천 차단, T-022).
//
// T-021 요구사항(개발요청서.md I 항목): "Permission 응답 주입은 안전 게이트가 살아있을 때만
// 동작". 이를 강제하기 위해 injectPermissionDecision은 매번 호출 시점에 stage1 가드 상태를
// 다시 확인하고, 통과하지 못하면 tmux에 아무것도 보내지 않고 예외를 던진다 — "게이트가 꺼지면
// 원격 승인 자체가 불가능해야 한다"는 요구를 코드로 강제한다(캐시된 과거 결과를 신뢰하지 않고
// 매 주입 시점에 재확인).
import { spawnSync } from "node:child_process";
import { mapAskUserQuestionAnswer, mapPermissionDecision } from "./key-mapping.mjs";
import { checkStage1GuardActive } from "./safety-gate-stage1.mjs";

function sendKeys(sessionName, keys) {
  const r = spawnSync("tmux", ["send-keys", "-t", sessionName, ...keys], { encoding: "utf8" });
  if (r.error || r.status !== 0) {
    throw new Error(`tmux send-keys 실패(session=${sessionName}): ${r.stderr || r.error?.message}`);
  }
}

/**
 * AskUserQuestion 응답 주입(T-020). 안전 게이트와 무관하게 동작한다 — 게이트는 "도구 실행
 * 권한"을 다루는 Permission 트랙에만 걸린다(개발요청서.md I 항목이 명시적으로 Permission만
 * 지목함). AskUserQuestion은 이미 나온 선택지 중 하나를 고르는 것뿐이라 위험 명령 실행과 무관.
 * @param {string} sessionName
 * @param {number} optionIndex 1부터 시작하는 선택지 번호
 */
export function injectAskUserQuestionAnswer(sessionName, optionIndex) {
  sendKeys(sessionName, mapAskUserQuestionAnswer(optionIndex));
}

/**
 * Permission 승인/거부 응답 주입(T-021). 안전 게이트 1단계가 살아있는지 매번 재확인한다.
 * @param {string} sessionName
 * @param {string} projectDir 게이트 재검증 대상 프로젝트 루트
 * @param {"approve"|"deny"} decision
 */
export function injectPermissionDecision(sessionName, projectDir, decision) {
  const gate = checkStage1GuardActive(projectDir);
  if (!gate.passed) {
    throw new Error(
      `안전 게이트 1단계가 통과하지 못한 상태라 Permission 응답을 주입하지 않습니다: ${gate.reason}`
    );
  }
  sendKeys(sessionName, mapPermissionDecision(decision));
}
