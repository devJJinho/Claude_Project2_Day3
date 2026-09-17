// 선택지/승인 응답 → tmux 키 입력 매핑(T-022). 이 파일이 이 프로젝트의 가장 중요한 보안
// 경계다: 웹에서 온 값이 무엇이든, 여기를 통과하지 못하면 tmux send-keys로 절대 전달되지 않는다.
//
// 원칙(개발요청서.md I 항목·B 항목): 자유 텍스트는 절대 받지 않는다. 이 모듈의 모든 공개
// 함수는 "사전 정의된 유한 집합(whitelist)"에 속한 값만 받고, 그 외에는 예외를 던진다 — 조용히
// sanitize해서 통과시키지 않는다(모르는 값은 무조건 거부).
//
// 정확한 키 시퀀스(예: 숫자키 vs 화살표+Enter)는 실제 Claude Code TUI를 tmux 위에서 붙여
// 눈으로 확인하며 검증해야 한다. 이 구현은 "AskUserQuestion/Permission 프롬프트가 번호가 매겨진
// 목록을 보여주고 숫자 입력 후 Enter로 확정한다"는 일반적인 CLI 메뉴 관례를 1차 가정으로 삼는다.
// 이 가정이 실제 동작과 다르면 이 파일의 매핑 부분만 고치면 되고, 호출부(tmux-inject.mjs)와
// 화이트리스트 검증 구조는 그대로 유지된다.

export const MAX_ASK_QUESTION_OPTIONS = 9;
// web-app 트랙(app/api/permissions/route.ts)이 실제로 검증하는 값과 동일하게 맞춘다 —
// "approve"|"deny" 둘 뿐이다(allow_once/allow_always 같은 3단계가 아니다).
export const PERMISSION_DECISIONS = Object.freeze(["approve", "deny"]);

export class UnrecognizedResponseError extends Error {
  constructor(kind, value) {
    super(`화이트리스트에 없는 ${kind} 값이라 거부합니다: ${JSON.stringify(value)}`);
    this.name = "UnrecognizedResponseError";
  }
}

function isPositiveIntInRange(value, max) {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

/**
 * AskUserQuestion 응답을 tmux 키 시퀀스로 변환한다.
 * @param {number} optionIndex 1부터 시작하는 선택지 번호(웹 UI 버튼 = 선택지 하나당 버튼 하나,
 *   버튼이 보내는 값은 항상 이 정수뿐 — 라벨 텍스트 자체를 보내지 않는다).
 * @returns {string[]} tmux send-keys에 순서대로 넘길 키 목록
 */
export function mapAskUserQuestionAnswer(optionIndex) {
  if (!isPositiveIntInRange(optionIndex, MAX_ASK_QUESTION_OPTIONS)) {
    throw new UnrecognizedResponseError("AskUserQuestion optionIndex", optionIndex);
  }
  return [String(optionIndex), "Enter"];
}

/**
 * Permission 승인/거부 응답을 tmux 키 시퀀스로 변환한다.
 *
 * 2026-09-17 실제 Claude Code(v2.1.274) 권한 프롬프트를 tmux 위에서 라이브로 띄워 확인한 결과
 * (agent-cli/README.md "실측 기록" 참고), 옵션 개수는 고정이 아니다 — 이번에 뜬 Bash 권한
 * 프롬프트는 "1. Yes / 2. Yes, and always allow.../ 3. Yes, and switch to auto mode / 4. No"
 * 4개였다. 즉 deny(="No")가 항상 마지막 옵션은 맞지만 그 번호(2 vs 3 vs 4)는 옵션 구성에 따라
 * 달라져서, 숫자로 deny를 고정하면 실제로는 "항상 허용"(approve-always) 같은 완전히 다른,
 * 더 위험한 선택지를 눌러버릴 수 있다 — 실제로 예전 구현(digit "2")이 정확히 이 버그였다.
 *
 * 그래서 deny는 옵션 번호에 의존하지 않는 **Esc**로 매핑한다 — 이 화면의 푸터가 항상
 * "Esc to cancel"이라고 명시하는, 옵션 구성과 무관한 유일한 안정적 취소 방법이다.
 * approve는 확인된 대로 항상 첫 번째("1. Yes" — 승인 중 가장 보수적인 "이번만 허용")로 둔다.
 * @param {"approve"|"deny"} decision
 * @returns {string[]}
 */
export function mapPermissionDecision(decision) {
  if (!PERMISSION_DECISIONS.includes(decision)) {
    throw new UnrecognizedResponseError("Permission decision", decision);
  }
  if (decision === "deny") return ["Escape"];
  return ["1", "Enter"];
}

// 자유 텍스트 경로가 코드베이스 어디에도 생기지 않도록, "검증되지 않은 임의 문자열을 그대로
// 키 목록으로 변환"하는 함수는 이 파일에 의도적으로 존재하지 않는다. 새 응답 종류를 추가할 때도
// 반드시 유한 화이트리스트 + 정수 인덱스 방식을 따를 것(개발요청서.md 비목표 항목).
