#!/usr/bin/env node
// PreToolUse(Edit|Write) 훅: PROGRESS.md는 backlog.json으로부터 자동 생성되는 파일이라
// 직접 편집을 막는다. 다른 파일은 그대로 통과시킨다.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? "";
if (basename(filePath) !== "PROGRESS.md") {
  process.exit(0);
}

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "PROGRESS.md는 backlog.json으로부터 자동 생성됩니다. 대신 backlog.json을 수정한 뒤 `node .claude/hooks/update-progress.mjs`를 실행하세요.",
    },
  })
);
process.exit(0);
