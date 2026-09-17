// Permission 프롬프트 발생 감지 훅(T-016). settings.json에 등록되는 위임형 훅
// (`claudebridge hook permission`)이 stdin으로 받는 Notification 이벤트를 처리한다.
//
// 가정(검증 필요 — README.md 참고): Claude Code의 Notification 훅은 권한 승인 대기·유휴
// 대기 등 다양한 상황에서 공통으로 호출되며, 구조화된 tool_name 필드 없이
// `{ session_id, cwd, message: "Claude needs your permission to use <Tool>" }` 형태의
// 자유 텍스트 메시지만 준다고 가정한다. 이 훅은 message에 "permission"(또는 한국어 "권한")이
// 포함된 경우만 Permission 이벤트로 취급하고, 그 외(유휴 알림 등)는 무시한다. 도구 이름은
// 메시지 텍스트에서 정규식으로 최대한 추출하되, 못 찾으면 "unknown"으로 기록한다 — 실제
// Notification payload 스키마를 확인하는 대로 이 파일의 isPermissionNotification()/
// extractToolName()만 고치면 된다.
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
  const payload = { toolName: extractToolName(message), message };
  const { id } = await recordBlockedEvent({ projectId: match.projectId, kind: "permission", payload });
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
