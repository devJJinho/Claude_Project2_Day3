#!/usr/bin/env node
// oxlint 실행 래퍼. 도구가 설치돼 있지 않으면 NOT_CONFIGURED를 보고하고 통과로 처리하지 않는다.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LINT_COMMAND, INNER_CHECK_TIMEOUT_MS } from "./quality-config.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string[]} [paths] 생략 시 quality-config.LINT_COMMAND.args(전체 소스 디렉터리)
 * @returns {{status:"PASS"|"FAIL"|"TIMEOUT"|"NOT_CONFIGURED", output:string}}
 */
export function runLint(paths) {
  const binPath = path.join(PROJECT_ROOT, LINT_COMMAND.cmd);
  if (!existsSync(binPath)) {
    return { status: "NOT_CONFIGURED", output: `lint 도구가 없습니다: ${LINT_COMMAND.cmd} (npm install 필요)` };
  }
  const targets = paths && paths.length > 0 ? paths : LINT_COMMAND.defaultArgs;
  const args = [...LINT_COMMAND.flags, ...targets];
  const r = spawnSync(binPath, args, { cwd: PROJECT_ROOT, timeout: INNER_CHECK_TIMEOUT_MS, encoding: "utf8" });
  if (r.error && r.error.code === "ETIMEDOUT") {
    return { status: "TIMEOUT", output: `lint가 ${INNER_CHECK_TIMEOUT_MS}ms 내 끝나지 않았습니다.` };
  }
  if (r.status === 0) {
    return { status: "PASS", output: (r.stdout || "").trim() };
  }
  return { status: "FAIL", output: ((r.stdout || "") + (r.stderr || "")).trim() };
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const targets = process.argv.slice(2);
  const result = runLint(targets.length > 0 ? targets : undefined);
  console.log(`lint: ${result.status}`);
  if (result.output) console.log(result.output);
  process.exit(result.status === "PASS" ? 0 : 1);
}
