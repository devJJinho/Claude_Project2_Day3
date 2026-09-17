#!/usr/bin/env node
// 이 프로젝트(Node ESM 스크립트, 번들러/트랜스파일러 없음)에는 별도의 "빌드 산출물 생성" 단계가
// 없다 — 소스를 그대로 node로 실행하기 때문이다. 그렇다고 build를 통과로 조작하지 않기 위해,
// 실제로 수행 가능한 대체 검증으로 모든 소스 파일에 `node --check`(문법+모듈 해석 검사, 실행은
// 하지 않음)를 돌린다. 완료 조건: SOURCE_DIRS의 모든 .mjs 파일에서 node --check가 exit 0.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listSourceFiles } from "./check-code-length.mjs";
import { INNER_CHECK_TIMEOUT_MS } from "./quality-config.mjs";

export function runBuildCheck() {
  const files = listSourceFiles();
  const failures = [];
  const timeouts = [];

  for (const f of files) {
    const r = spawnSync(process.execPath, ["--check", f], {
      timeout: INNER_CHECK_TIMEOUT_MS,
      encoding: "utf8",
    });
    if (r.error && r.error.code === "ETIMEDOUT") {
      timeouts.push(f);
      continue;
    }
    if (r.status !== 0) {
      failures.push({ file: f, stderr: (r.stderr || "").trim() });
    }
  }

  return { files, failures, timeouts };
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  console.log("이 스택(Node ESM 스크립트)에는 별도 빌드 단계가 없습니다 — 대체 검증: 전체 소스 `node --check`.");
  const { files, failures, timeouts } = runBuildCheck();
  if (failures.length === 0 && timeouts.length === 0) {
    console.log(`build(문법 검사) 통과: ${files.length}개 파일`);
    process.exit(0);
  }
  for (const f of failures) {
    console.error(`FAIL: ${f.file}\n${f.stderr}`);
  }
  for (const f of timeouts) {
    console.error(`TIMEOUT(미검증): ${f} — ${INNER_CHECK_TIMEOUT_MS}ms 내 완료되지 않아 통과로 취급하지 않음`);
  }
  process.exit(1);
}
