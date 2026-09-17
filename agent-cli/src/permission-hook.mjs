// Permission 프롬프트 발생 감지 훅(T-016). settings.json에 등록되는 위임형 훅
// (`claudebridge hook permission`)이 stdin으로 받는 Notification 이벤트를 처리한다.
//
// payload 형태는 schema-contract.mjs/web-app의 PermissionPayload와 정확히 맞춘다:
// `{ tool: string, command: string, description?: string }`.
//
// 확인이 필요한 가정(README.md 참고, 미해결로 남음): Claude Code의 Notification 훅은
// `{ session_id, cwd, message: "Claude needs your permission to use <Tool>" }` 형태의 자유
// 텍스트 메시지만 주고, tool_input(command/description)까지는 구조화해서 주지 않는다고
// 가정한다. 그래서 `tool`은 메시지에서 정규식으로 추출하지만, `command`/`description`은
// Notification만으로는 알 수 없어 빈 문자열로 남긴다(대시보드에는 "어떤 도구인지"는 보이지만
// "정확히 어떤 명령인지"는 안 보일 수 있음 — 알려진 한계). 더 정확히 하려면 PreToolUse 훅에서
// tool_input을 세션별로 임시 캐싱해뒀다가 Notification 발생 시 합치는 2단계 상관관계 방식이
// 필요한데, 마감(J 항목) 안에서는 범위 밖으로 남긴다.
import { findProjectByLocalPath, loadConfig } from "./config.mjs";
import { recordBlockedEvent } from "./blocked-events.mjs";
import { sendPushForBlockedEvent } from "./push-sender.mjs";

function isPermissionNotification(message) {
  return /permission|권한/i.test(message ?? "");
}

function extractToolName(message) {
  const m = /use\s+([A-Za-z][\w-]*)/.exec(message ?? "");
  return m ? m[1] : "unknown";
}

/**
 * @param {any} hookInput Notification stdin JSON
 */
export async function handlePermissionHook(hookInput) {
  const message = hookInput?.message ?? "";
  if (!isPermissionNotification(message)) return; // 유휴 알림 등 — 이 트랙에서 다루지 않음

  const projectDir = hookInput?.cwd || process.cwd();
  const match = findProjectByLocalPath(projectDir);
  if (!match) {
    console.error(`[permission-hook] 등록되지 않은 프로젝트(${projectDir}) — claudebridge init을 먼저 실행하세요.`);
    return;
  }
  const payload = { tool: extractToolName(message), command: "", description: message };
  const { id } = await recordBlockedEvent({ projectId: match.projectId, type: "permission", payload });
  const cfg = loadConfig();
  await sendPushForBlockedEvent("permission", payload, cfg.dashboardUrl);
  console.error(`[permission-hook] blocked_events 기록 완료(id=${id})`);
}

export async function runPermissionHookFromStdin(readStdinJson) {
  let hookInput;
  try {
    hookInput = await readStdinJson();
  } catch {
    return;
  }
  try {
    await handlePermissionHook(hookInput);
  } catch (err) {
    console.error(`[permission-hook] 처리 실패(허용 상태로 계속 진행): ${err.message}`);
  }
}
