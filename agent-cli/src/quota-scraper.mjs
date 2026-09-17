// tmux 위의 실제 Claude Code 세션에 `/status`를 띄워 "이번 세션/이번 주 사용률(%)"을
// 읽어오는 스크래퍼(사용자 요청 2026-09-17). 이 값은 로그 파일에서 계산할 수 없다 — 요금제별
// 한도·가중치를 Claude Code 자신만 알고 있고, `/status`의 Usage 탭 화면으로만 보여준다.
//
// 안전 원칙: 이 스크래퍼는 사용자가 실제로 작업 중인 그 tmux pane에 개입한다(질문/권한
// 응답 주입과 달리, Claude Code가 "이미 멈춰서 기다리는" 시점이 아니라 아무 때나 끼어든다).
// 그래서 두 조건을 확인해 하나라도 걸리면 아무것도 보내지 않고 건너뛴다(2026-09-17 실측
// 기반 — agent-cli/README.md 참고):
//   1) 푸터에 "esc to interrupt"가 보이면(=Claude가 한창 생성 중) 건너뛴다.
//   2) 입력줄(❯ 로 시작하는 줄)에 placeholder 힌트든 실제 타이핑이든 "❯" 뒤에 아무 글자나
//      있으면 건너뛴다 — 플레이스홀더와 실제 입력을 텍스트만으로는 구분할 수 없어서, 더
//      안전한 쪽(건너뛰기)을 택한다. 다음 주기(권장 5분)에 다시 시도하면 된다.
import { spawnSync } from "node:child_process";

function tmux(args) {
  return spawnSync("tmux", args, { encoding: "utf8" });
}

function capturePane(sessionName) {
  const r = tmux(["capture-pane", "-t", sessionName, "-p"]);
  if (r.error || r.status !== 0) return null;
  return r.stdout ?? "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPaneSafeToInterrupt(paneText) {
  if (paneText == null) return false;
  if (/esc to interrupt/i.test(paneText)) return false;
  const lines = paneText.split("\n");
  const promptLine = lines.find((l) => l.trim().startsWith("❯"));
  if (promptLine === undefined) return false; // 입력줄 자체를 못 찾으면 안전하지 않다고 본다.
  const afterPrompt = promptLine.trim().replace(/^❯\s?/, "");
  return afterPrompt.length === 0;
}

function parseQuotaSection(text, headerPattern) {
  const re = new RegExp(headerPattern + "[^\\n]*\\n[^\\n]*?(\\d{1,3})%\\s*used\\s*\\n\\s*Resets\\s+([^\\n]+)");
  const m = text.match(re);
  if (!m) return null;
  const percent = Number(m[1]);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return null;
  return { percentUsed: percent, resetsAt: m[2].trim() };
}

/**
 * @param {string} sessionName
 * @returns {Promise<{skipped:true, reason:string} | {skipped:false, sessionPercentUsed:number,
 *   sessionResetsAt:string, weekPercentUsed:number, weekResetsAt:string}>}
 */
export async function scrapeStatusQuota(sessionName) {
  const before = capturePane(sessionName);
  if (!isPaneSafeToInterrupt(before)) {
    return { skipped: true, reason: "세션이 활성 상태(생성 중이거나 입력 중으로 추정)라 건너뜀" };
  }

  tmux(["send-keys", "-t", sessionName, "/status"]);
  await sleep(300);
  tmux(["send-keys", "-t", sessionName, "Enter"]);
  await sleep(1500);
  tmux(["send-keys", "-t", sessionName, "Right"]);
  await sleep(400);
  tmux(["send-keys", "-t", sessionName, "Right"]);
  await sleep(1200);

  const statusText = capturePane(sessionName) ?? "";

  // 항상 닫는다 — 파싱에 실패해도 사용자 화면을 /status 오버레이에 남겨두지 않는다.
  tmux(["send-keys", "-t", sessionName, "Escape"]);
  await sleep(300);

  const session = parseQuotaSection(statusText, "Current session");
  const week = parseQuotaSection(statusText, "Current week \\(all models\\)");
  if (!session || !week) {
    return { skipped: true, reason: "/status Usage 탭 화면 파싱 실패(레이아웃이 바뀌었을 수 있음)" };
  }
  return {
    skipped: false,
    sessionPercentUsed: session.percentUsed,
    sessionResetsAt: session.resetsAt,
    weekPercentUsed: week.percentUsed,
    weekResetsAt: week.resetsAt,
  };
}
