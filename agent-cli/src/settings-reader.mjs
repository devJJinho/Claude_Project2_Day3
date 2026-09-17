// 대상 프로젝트의 .claude/settings.json을 읽기 전용으로 다루는 헬퍼.
// (쓰기는 settings-writer.mjs — 읽기/쓰기 책임 분리, code-structure.md 원칙)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function settingsPath(projectDir) {
  return path.join(projectDir, ".claude", "settings.json");
}

/**
 * @param {string} projectDir 대상 프로젝트 루트
 * @returns {object|null} 파싱된 settings.json, 없거나 파싱 실패 시 null
 */
export function readSettings(projectDir) {
  const p = settingsPath(projectDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * settings.json의 hooks[eventName] 배열에서 matcher가 주어진 도구 이름과 겹치는 command
 * 문자열들을 모두 뽑는다. matcher는 "Bash", "Edit|Write"처럼 '|'로 여러 도구를 나열할 수 있다.
 * @param {object|null} settings readSettings() 결과
 * @param {string} eventName 예: "PreToolUse"
 * @param {string} toolName 예: "Bash"
 * @returns {string[]} 매칭된 hook command 문자열 목록
 */
export function findHookCommands(settings, eventName, toolName) {
  const entries = settings?.hooks?.[eventName];
  if (!Array.isArray(entries)) return [];
  const commands = [];
  for (const entry of entries) {
    const matcher = entry?.matcher;
    const matches =
      matcher === undefined ||
      matcher === "*" ||
      String(matcher)
        .split("|")
        .map((s) => s.trim())
        .includes(toolName);
    if (!matches) continue;
    for (const h of entry?.hooks ?? []) {
      if (h?.type === "command" && typeof h.command === "string") commands.push(h.command);
    }
  }
  return commands;
}
