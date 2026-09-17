// Claude Code 훅은 표준입력으로 JSON 하나를 통째로 준다. 이 헬퍼 하나로 모든 훅 진입점
// (guard/ask-question/permission)이 동일한 방식으로 읽는다.
//
// CLAUDEBRIDGE_HOOK_DEBUG=1이면 실제 Claude Code가 보내는 원본 stdin을
// ~/.claudebridge/hook-debug.log에 이어쓴다 — Notification/PreToolUse 실제 payload
// 스키마(필드명)를 문서가 아니라 실측으로 확인하기 위한 진단 장치(2026-09-17 도입).
// 기본값은 꺼짐이다 — tool_input에 파일 내용 등 민감할 수 있는 값이 그대로 들어올 수 있어
// 평소에는 디스크에 남기지 않는다. 문제 재현이 안 될 때만 명시적으로 켜서 쓴다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function readStdinJson() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      if (process.env.CLAUDEBRIDGE_HOOK_DEBUG === "1") {
        try {
          const line = `${new Date().toISOString()} argv=${JSON.stringify(process.argv.slice(2))} stdin=${data}\n`;
          fs.appendFileSync(path.join(os.homedir(), ".claudebridge", "hook-debug.log"), line);
        } catch {
          // 진단 로그 실패는 무시 — 훅 본연의 동작을 막으면 안 됨
        }
      }
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on("error", reject);
  });
}
