// 대상 프로젝트의 .claude/settings.json에 훅 항목을 멱등하게(중복 없이) 병합해 쓴다.
// 기존 사용자 설정(다른 matcher/훅)은 절대 지우지 않고 append만 한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readSettings, settingsPath } from "./settings-reader.mjs";

function sameHookEntry(a, b) {
  return a?.type === b?.type && a?.command === b?.command;
}

/**
 * hooks[eventName]에 matcher가 정확히 일치하는 항목이 있으면 그 안에 command를 추가하고,
 * 없으면 새 { matcher, hooks:[...] } 항목을 만든다. 이미 동일한 command가 있으면 아무것도
 * 하지 않는다(재실행해도 중복 등록되지 않음 — claudebridge init을 여러 번 돌려도 안전).
 * @param {object} settings 원본 settings.json(변형해서 반환)
 * @param {string} eventName 예: "PreToolUse"
 * @param {string} matcher 예: "Bash"
 * @param {object} hookEntry { type:"command", command, statusMessage? }
 */
export function mergeHook(settings, eventName, matcher, hookEntry) {
  const next = { ...settings, hooks: { ...settings.hooks } };
  const list = Array.isArray(next.hooks[eventName]) ? [...next.hooks[eventName]] : [];
  const idx = list.findIndex((e) => e?.matcher === matcher);
  if (idx === -1) {
    list.push({ matcher, hooks: [hookEntry] });
  } else {
    const group = { ...list[idx], hooks: [...(list[idx].hooks || [])] };
    if (!group.hooks.some((h) => sameHookEntry(h, hookEntry))) group.hooks.push(hookEntry);
    list[idx] = group;
  }
  next.hooks[eventName] = list;
  return next;
}

/**
 * @param {string} projectDir 대상 프로젝트 루트
 * @param {Array<{eventName:string, matcher:string, hookEntry:object}>} hooksToInstall
 * @returns {object} 최종적으로 기록된 settings 객체
 */
export function installHooks(projectDir, hooksToInstall) {
  let settings = readSettings(projectDir) ?? {};
  for (const { eventName, matcher, hookEntry } of hooksToInstall) {
    settings = mergeHook(settings, eventName, matcher, hookEntry);
  }
  const p = settingsPath(projectDir);
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(settings, null, 2) + "\n", "utf8");
  return settings;
}

// 재검증(re-verify)용: 실제로 파일에 쓰인 내용을 다시 읽어 왔는지 확인할 때 사용.
export function reReadSettings(projectDir) {
  return JSON.parse(readFileSync(settingsPath(projectDir), "utf8"));
}
