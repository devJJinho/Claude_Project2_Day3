// AskUserQuestion 발생 감지 훅(T-015). settings.json에 등록되는 위임형 훅
// (`claudebridge hook ask-question`)이 stdin으로 받는 PreToolUse 이벤트를 처리한다.
//
// 가정(검증 필요 — README.md "확인이 필요한 가정" 참고): AskUserQuestion tool_input은
// `{ questions: [{ question, header?, options: [{ label, description? }], multiSelect? }] }`
// 형태라고 가정한다(Claude Code의 일반적인 다중 선택 질문 도구 스키마 관례). 실제 필드명이
// 다르면 이 파일의 extractPayload()만 고치면 된다 — 이후 파이프라인(blocked-events 기록,
// 웹 표시, key-mapping 응답)은 이 payload 형태에만 의존한다.
//
// 1차 구현 범위: 질문이 여러 개(questions 배열 길이 > 1)여도 첫 번째 질문만 웹에 노출하고
// 응답도 첫 번째 질문에만 적용한다(다중 질문 동시 응답은 이후 확장 과제 — README에 기록).
//
// 이 훅은 "감지해서 기록"만 하는 정보성 훅이라 항상 허용(exit 0, 아무 출력 없음)한다 —
// Claude Code의 진행을 절대 막지 않는다. Supabase/네트워크 오류가 나도 세션이 끊기면 안 되므로
// 모든 예외를 잡아 stderr에만 남기고 정상 종료한다.
import { findProjectByLocalPath, loadConfig } from "./config.mjs";
import { recordBlockedEvent } from "./blocked-events.mjs";
import { sendPushForBlockedEvent } from "./push-sender.mjs";

function extractPayload(toolInput) {
  const q = toolInput?.questions?.[0];
  if (!q) return { question: "(질문 내용을 인식하지 못함)", options: [], raw: toolInput };
  const options = (q.options ?? []).map((opt, idx) => ({
    index: idx + 1,
    label: opt?.label ?? String(opt),
    description: opt?.description ?? undefined,
  }));
  return { question: q.question ?? q.header ?? "(제목 없음)", header: q.header, options };
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
    kind: "ask_user_question",
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
