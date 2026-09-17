// 위임형 훅 템플릿(T-043): 대상 프로젝트의 .claude/settings.json에는 로직 파일을 복사해
// 넣지 않고, 전역 설치된 claudebridge CLI를 호출하는 "한 줄"만 등록한다(개발요청서.md H 항목
// — "훅 본문은 전역 CLI를 호출하는 한 줄뿐, 로직 파일을 복사하지 않음").
//
// 실제 판정/감지 로직(guard-hook-logic.mjs, ask-question-hook.mjs, permission-hook.mjs)은
// 모두 이 npm 패키지 안에만 존재한다 — 프로젝트를 여러 개 연결해도 로직 사본이 늘어나지 않고,
// CLI를 업데이트하면 이미 연결된 모든 프로젝트가 함께 최신 로직을 쓰게 된다.
export const DELEGATE_HOOKS = [
  {
    id: "guard",
    eventName: "PreToolUse",
    matcher: "Bash",
    hookEntry: {
      type: "command",
      command: "claudebridge hook guard",
      statusMessage: "ClaudeBridge: 위험 명령어 차단 검증",
    },
  },
  {
    id: "ask-question",
    eventName: "PreToolUse",
    matcher: "AskUserQuestion",
    hookEntry: {
      type: "command",
      command: "claudebridge hook ask-question",
      statusMessage: "ClaudeBridge: 질문 대기 상태를 웹으로 전송",
    },
  },
  {
    id: "permission",
    eventName: "Notification",
    matcher: undefined,
    hookEntry: {
      type: "command",
      command: "claudebridge hook permission",
      statusMessage: "ClaudeBridge: 알림(권한 승인 대기 등)을 웹으로 전송",
    },
  },
];

/**
 * @param {string[]} ids DELEGATE_HOOKS 중 설치할 항목의 id 목록. 생략하면 전부.
 * @returns {Array<{eventName:string, matcher:string, hookEntry:object}>} settings-writer.installHooks에 바로 넘길 수 있는 형태
 */
export function buildHooksToInstall(ids) {
  const wanted = ids ?? DELEGATE_HOOKS.map((h) => h.id);
  return DELEGATE_HOOKS.filter((h) => wanted.includes(h.id)).map(({ eventName, matcher, hookEntry }) => ({
    eventName,
    matcher,
    hookEntry,
  }));
}
