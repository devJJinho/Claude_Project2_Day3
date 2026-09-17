// tmux 세션 존재 확인/생성(T-019).
//
// 미결 질문(개발요청서.md 4장): "claudebridge init이 기존 tmux 세션을 감지해 재사용할지,
// 항상 새 세션을 만들지" — 여기서 재사용(reuse-if-exists)으로 정한다. 근거: project_id마다
// 세션명을 고정(`claudebridge-<project_id>`)하므로, init을 재실행(설정 갱신·재연결 목적)해도
// 이미 그 프로젝트용으로 떠 있는 Claude Code 프로세스를 중복 실행시키지 않는 편이 안전하다.
// 완전히 새 세션이 필요하면 별도로 세션을 죽이고 다시 init하면 된다(--fresh 같은 강제 옵션은
// 이후 필요성이 확인되면 추가 — 지금은 과설계하지 않는다).
//
// tmux 명령은 항상 인자 배열로 spawn한다(shell:true 사용 안 함) — 세션명/경로에 셸 메타문자가
// 섞여도 해석되지 않도록 하기 위함(T-022의 "임의 텍스트 주입 차단" 원칙을 세션 생성 단계에도
// 동일하게 적용).
import { spawnSync } from "node:child_process";

export function tmuxSessionName(projectId) {
  return `claudebridge-${projectId}`;
}

function runTmux(args, opts = {}) {
  return spawnSync("tmux", args, { encoding: "utf8", ...opts });
}

export function isTmuxAvailable() {
  const r = runTmux(["-V"]);
  return !r.error && r.status === 0;
}

export function hasSession(sessionName) {
  const r = runTmux(["has-session", "-t", sessionName]);
  return !r.error && r.status === 0;
}

export function createSession(sessionName, cwd) {
  const r = runTmux(["new-session", "-d", "-s", sessionName, "-c", cwd]);
  if (r.error || r.status !== 0) {
    throw new Error(`tmux 세션 생성 실패(${sessionName}): ${r.stderr || r.error?.message}`);
  }
}

/**
 * 세션이 없으면 만들고, 있으면 재사용한다.
 * @param {string} sessionName
 * @param {string} cwd 세션 생성 시 시작 디렉터리(프로젝트 루트)
 * @returns {{created: boolean}} created=true면 방금 새로 만든 세션(→ Claude Code 자동 실행 대상)
 */
export function ensureSession(sessionName, cwd) {
  if (hasSession(sessionName)) return { created: false };
  createSession(sessionName, cwd);
  return { created: true };
}

/**
 * 새로 만든 세션 안에서 Claude Code를 실행한다. 재사용한 세션에는 호출하지 않는다(이미 그
 * 세션 안에서 뭔가 실행 중이라고 가정 — 중복 실행 방지).
 */
export function startClaudeCode(sessionName, claudeCommand = "claude") {
  const r = runTmux(["send-keys", "-t", sessionName, claudeCommand, "Enter"]);
  if (r.error || r.status !== 0) {
    throw new Error(`tmux send-keys 실패(${sessionName}): ${r.stderr || r.error?.message}`);
  }
}
