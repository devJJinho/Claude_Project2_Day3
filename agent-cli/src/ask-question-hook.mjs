// AskUserQuestion 발생 감지 훅(T-015). settings.json에 등록되는 위임형 훅
// (`claudebridge hook ask-question`)이 stdin으로 받는 PreToolUse 이벤트를 처리한다.
//
// payload 형태는 schema-contract.mjs/web-app의 AskUserQuestionPayload와 정확히 맞춘다:
// `{ question: string, options: string[] }` — options는 라벨 문자열 배열 그대로(인덱스는
// 배열 위치로 암묵적으로 정해짐, 1번=options[0]). 웹 UI는 이 문자열 중 하나를 그대로
// responses.choice로 보내고, 로컬 에이전트(responses-poller.mjs)가 그 문자열이 options의
// 몇 번째인지 찾아 tmux 키 입력으로 변환한다.
//
// 확인이 필요한 가정(여전히 남아있음 — README.md 참고): Claude Code AskUserQuestion의 실제
// tool_input 필드명. `{ questions: [{ question, options: [{label}, ...] }] }` 형태로 가정한다
// (Claude Code의 일반적인 다중 선택 질문 도구 관례). 다중 질문(questions.length > 1)은 1차
// 구현 범위 밖 — 첫 번째 질문만 처리한다.
//
// 이 훅은 "감지해서 기록"만 하는 정보성 훅이라 항상 허용(exit 0, 아무 출력 없음)한다 —
// Claude Code의 진행을 절대 막지 않는다. Supabase/네트워크 오류가 나도 세션이 끊기면 안 되므로
// 모든 예외를 잡아 stderr에만 남기고 정상 종료한다.
import { findProjectByLocalPath, loadConfig } from "./config.mjs";
import { recordBlockedEvent } from "./blocked-events.mjs";
import { sendPushForBlockedEvent } from "./push-sender.mjs";

function extractPayload(toolInput) {
  const q = toolInput?.questions?.[0];
  if (!q) return { question: "(질문 내용을 인식하지 못함)", options: [] };
  const options = (q.options ?? []).map((opt) => (typeof opt === "string" ? opt : opt?.label ?? String(opt)));
  return { question: q.question ?? q.header ?? "(제목 없음)", options };
}

/**
 * @param {any} hookInput PreToolUse(AskUserQuestion) stdin JSON
 */
export async function handleAskUserQuestionHook(hookInput) {
  const projectDir = hookInput?.cwd || process.cwd();
  const match = findProjectByLocalPath(projectDir);
  if (!match) {
    console.error(`[ask-question-hook] 등록되지 않은 프로젝트(${projectDir}) — claudebridge init을 먼저 실행하세요.`);
    return;
  }
  const payload = extractPayload(hookInput?.tool_input);
  const { id } = await recordBlockedEvent({
    projectId: match.projectId,
    type: "ask_user_question",
    payload,
  });
  const cfg = loadConfig();
  await sendPushForBlockedEvent("ask_user_question", payload, cfg.dashboardUrl);
  console.error(`[ask-question-hook] blocked_events 기록 완료(id=${id})`);
}

export async function runAskQuestionHookFromStdin(readStdinJson) {
  let hookInput;
  try {
    hookInput = await readStdinJson();
  } catch {
    return; // 입력을 못 읽으면 조용히 통과(허용) — 정보성 훅이 세션을 막으면 안 됨
  }
  try {
    await handleAskUserQuestionHook(hookInput);
  } catch (err) {
    console.error(`[ask-question-hook] 처리 실패(허용 상태로 계속 진행): ${err.message}`);
  }
}
