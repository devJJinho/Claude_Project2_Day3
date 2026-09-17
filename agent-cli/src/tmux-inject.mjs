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
//
// 실측으로 발견한 위험(2026-09-17): Claude Code가 "auto mode"(permission_mode: auto)인
// 세션에서는 Permission Notification 훅이 뜨긴 하지만 화면상 실제 대화형 승인/거부 프롬프트
// 없이 자동으로 넘어간다 — 이 상태에서 웹 응답을 그대로 주입하면 프롬프트가 이미 사라진
// 뒤라 숫자/Esc 키가 다음 자유 입력줄에 그대로 타이핑되어 Claude에게 엉뚱한 텍스트로
// 전달된다(실측: "1"이 프롬프트에 그대로 입력됨). 그래서 주입 직전에 pane을 캡처해 실제로
// 그 다이얼로그가 떠 있는지 확인하고, 없으면 DialogNotShowingError를 던져 아무 키도
// 보내지 않는다.
import { spawnSync } from "node:child_process";
import { mapAskUserQuestionAnswer, mapPermissionDecision } from "./key-mapping.mjs";
import { checkStage1GuardActive } from "./safety-gate-stage1.mjs";

export class DialogNotShowingError extends Error {
  constructor(message) {
    super(message);
    this.name = "DialogNotShowingError";
  }
}

function tmux(args) {
  return spawnSync("tmux", args, { encoding: "utf8" });
}

function sendKeys(sessionName, keys) {
  const r = tmux(["send-keys", "-t", sessionName, ...keys]);
  if (r.error || r.status !== 0) {
    throw new Error(`tmux send-keys 실패(session=${sessionName}): ${r.stderr || r.error?.message}`);
  }
}

function capturePane(sessionName) {
  const r = tmux(["capture-pane", "-t", sessionName, "-p"]);
  if (r.error || r.status !== 0) return null;
  return r.stdout ?? "";
}

// 실제 권한 프롬프트 화면은 옵션 구성이 달라져도(2~4개, "always allow" 문구 유무) 항상
// 번호 매겨진 "N. Yes"류 항목과 "Esc to cancel" 안내를 함께 보여준다(agent-cli/README.md
// 실측 기록 참고) — 이 두 마커를 함께 요구해 오탐을 줄인다.
export function isPermissionDialogShowing(paneText) {
  if (paneText == null) return false;
  return /esc to cancel/i.test(paneText) && /\d\.\s*Yes\b/i.test(paneText);
}

// AskUserQuestion 화면은 항상 "Enter to select" 안내 footer를 보여준다.
export function isAskUserQuestionDialogShowing(paneText) {
  if (paneText == null) return false;
  return /enter to select/i.test(paneText);
}

/**
 * AskUserQuestion 응답 주입(T-020). 안전 게이트와 무관하게 동작한다 — 게이트는 "도구 실행
 * 권한"을 다루는 Permission 트랙에만 걸린다(개발요청서.md I 항목이 명시적으로 Permission만
 * 지목함). AskUserQuestion은 이미 나온 선택지 중 하나를 고르는 것뿐이라 위험 명령 실행과 무관.
 * @param {string} sessionName
 * @param {number} optionIndex 1부터 시작하는 선택지 번호
 */
export function injectAskUserQuestionAnswer(sessionName, optionIndex) {
  const paneText = capturePane(sessionName);
  if (!isAskUserQuestionDialogShowing(paneText)) {
    throw new DialogNotShowingError(
      `AskUserQuestion 대화상자가 더 이상 화면에 없어 응답을 주입하지 않습니다(session=${sessionName})`
    );
  }
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
  const paneText = capturePane(sessionName);
  if (!isPermissionDialogShowing(paneText)) {
    throw new DialogNotShowingError(
      `Permission 대화상자가 더 이상 화면에 없어 응답을 주입하지 않습니다(session=${sessionName}) — ` +
        `auto mode 등에서 이미 자동으로 처리됐을 수 있습니다`
    );
  }
  sendKeys(sessionName, mapPermissionDecision(decision));
}
