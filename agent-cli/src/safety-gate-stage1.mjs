// 안전 게이트 1단계: 대상 프로젝트에 위험 명령어 차단 훅이 "등록되어 있을 뿐 아니라 실제로
// 동작"하는지 검증한다(개발요청서.md I 항목). 설정 파일에 항목이 있는지만 보는 정적 검사로는
// 훅 스크립트가 깨져 있거나 조용히 통과시키는 경우를 놓칠 수 있어, 실제로 위험한 명령 문자열을
// 합성 PreToolUse 이벤트로 만들어 훅 프로세스에 표준입력으로 흘려보내고, 응답이 진짜로
// permissionDecision:"deny"인지까지 확인한다(명령을 실행하지는 않는다 — 문자열만 훅에 전달).
import { spawnSync } from "node:child_process";
import { findHookCommands, readSettings } from "./settings-reader.mjs";
import { SELF_TEST_DANGEROUS_COMMAND } from "./guard-hook-logic.mjs";

const SELF_TEST_TIMEOUT_MS = 10_000;

function runHookCommandWithSyntheticInput(command, projectDir) {
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: SELF_TEST_DANGEROUS_COMMAND },
  });
  // settings.json의 command는 "node .claude/hooks/x.mjs"처럼 셸에서 실행되는 문자열이다.
  // 프로젝트 훅과 동일한 실행 방식을 재현하기 위해 셸을 통해 그대로 실행한다.
  const result = spawnSync(command, {
    cwd: projectDir,
    input,
    shell: true,
    encoding: "utf8",
    timeout: SELF_TEST_TIMEOUT_MS,
  });
  return result;
}

function isDenyDecision(stdout) {
  if (!stdout) return false;
  try {
    const parsed = JSON.parse(stdout.trim().split("\n").pop());
    return parsed?.hookSpecificOutput?.permissionDecision === "deny";
  } catch {
    return false;
  }
}

/**
 * @param {string} projectDir 대상 프로젝트 루트(절대경로)
 * @returns {{passed: boolean, reason: string, checkedCommands: string[]}}
 */
export function checkStage1GuardActive(projectDir) {
  const settings = readSettings(projectDir);
  if (!settings) {
    return { passed: false, reason: ".claude/settings.json이 없습니다.", checkedCommands: [] };
  }
  const commands = findHookCommands(settings, "PreToolUse", "Bash");
  if (commands.length === 0) {
    return {
      passed: false,
      reason: ".claude/settings.json에 PreToolUse Bash 훅이 등록되어 있지 않습니다.",
      checkedCommands: [],
    };
  }
  for (const command of commands) {
    let result;
    try {
      result = runHookCommandWithSyntheticInput(command, projectDir);
    } catch {
      continue; // 이 훅은 실행 자체가 안 됨 — 다음 후보로
    }
    if (result.error || result.status !== 0) continue;
    if (isDenyDecision(result.stdout)) {
      return { passed: true, reason: `훅이 위험 명령을 차단함을 확인: ${command}`, checkedCommands: commands };
    }
  }
  return {
    passed: false,
    reason:
      `등록된 PreToolUse Bash 훅(${commands.join(", ")})이 자가진단 명령(${SELF_TEST_DANGEROUS_COMMAND})을 ` +
      `차단하지 않았습니다 — 등록만 돼 있고 실제로는 동작하지 않는 것으로 판단합니다.`,
    checkedCommands: commands,
  };
}
