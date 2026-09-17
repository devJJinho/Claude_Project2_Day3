// macOS `say`로 음성 안내를 내보내는 공통 헬퍼. notify-say*.mjs 훅들이 공유한다.
// 음성 안내 실패는 작업 흐름을 막을 이유가 아니므로 항상 조용히 무시한다.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const KOREAN_VOICE = "Yuna";
const SAY_TIMEOUT_MS = 10_000;

export function speak(message) {
  try {
    spawnSync("say", ["-v", KOREAN_VOICE, message], { timeout: SAY_TIMEOUT_MS });
  } catch {
    // 무시 — 음성 알림은 best-effort.
  }
}

export function readStdinJson() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
