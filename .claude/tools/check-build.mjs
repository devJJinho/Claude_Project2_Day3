#!/usr/bin/env node
// 두 종류의 소스가 섞여 있어 검사 방식을 나눈다:
// 1) backlog CLI/훅/대시보드용 Node ESM 스크립트(.mjs/.js) — 번들러/트랜스파일러가 없으므로
//    `node --check`(문법+모듈 해석 검사, 실행은 하지 않음)로 대체 검증한다.
// 2) Next.js 애플리케이션(.ts/.tsx, T-001~) — JSX/TS 문법은 `node --check`로 파싱되지 않고,
//    Next.js 자체는 `next build`가 실제 프로덕션 빌드지만 T-002/T-003/T-010(Vercel·Supabase·
//    Google OAuth 계정)이 아직 없어 런타임 환경변수 없이는 완주를 보장할 수 없다. 대신
//    `tsc --noEmit`(프로젝트 전체 타입체크, 산출물 생성 없음)를 "컴파일 통과" 기준으로 쓴다 —
//    CLAUDE.md/작업 지시서가 명시한 "컴파일/타입체크/린트 통과 수준"과 일치한다.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listSourceFiles, PROJECT_ROOT } from "./check-code-length.mjs";
import { INNER_CHECK_TIMEOUT_MS, TSC_TIMEOUT_MS } from "./quality-config.mjs";

function checkJsFiles(files) {
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
  return { failures, timeouts };
}

function checkTsProject(tsFiles) {
  if (tsFiles.length === 0) return { failures: [], timeouts: [] };
  const tsconfigPath = path.join(PROJECT_ROOT, "tsconfig.json");
  const tscBin = path.join(PROJECT_ROOT, "node_modules/.bin/tsc");
  if (!existsSync(tsconfigPath)) {
    return { failures: [{ file: "tsconfig.json", stderr: ".ts/.tsx 파일이 있지만 tsconfig.json이 없습니다." }], timeouts: [] };
  }
  if (!existsSync(tscBin)) {
    return { failures: [{ file: "typescript", stderr: "typescript가 설치돼 있지 않습니다 (npm install 필요)." }], timeouts: [] };
  }
  const r = spawnSync(tscBin, ["--noEmit", "-p", tsconfigPath], {
    cwd: PROJECT_ROOT,
    timeout: TSC_TIMEOUT_MS,
    encoding: "utf8",
  });
  if (r.error && r.error.code === "ETIMEDOUT") {
    return { failures: [], timeouts: ["tsc --noEmit (프로젝트 전체)"] };
  }
  if (r.status !== 0) {
    return { failures: [{ file: "tsc --noEmit (프로젝트 전체)", stderr: ((r.stdout || "") + (r.stderr || "")).trim() }], timeouts: [] };
  }
  return { failures: [], timeouts: [] };
}

export function runBuildCheck() {
  const files = listSourceFiles();
  const jsFiles = files.filter((f) => f.endsWith(".mjs") || f.endsWith(".js"));
  const tsFiles = files.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

  const js = checkJsFiles(jsFiles);
  const ts = checkTsProject(tsFiles);

  return {
    files,
    failures: [...js.failures, ...ts.failures],
    timeouts: [...js.timeouts, ...ts.timeouts],
  };
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
