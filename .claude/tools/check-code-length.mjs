#!/usr/bin/env node
// 소스 파일 줄 수 검사. backlog.json(데이터), PROGRESS.md/.bak(생성물), node_modules(의존성)는
// SOURCE_DIRS/SOURCE_EXTENSIONS 설정 자체로 애초에 스캔 대상이 아니다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LINE_LIMIT, SOURCE_DIRS, SOURCE_EXTENSIONS } from "./quality-config.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function listSourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    const abs = path.join(PROJECT_ROOT, dir);
    let entries;
    try {
      entries = readdirSync(abs);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext))) continue;
      const full = path.join(abs, name);
      if (statSync(full).isFile()) files.push(full);
    }
  }
  return files;
}

export function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content === "") return 0;
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

/**
 * @param {string[]} files 검사할 절대경로 목록
 * @returns {{file:string, lines:number}[]} LINE_LIMIT을 초과한 파일만
 */
export function checkCodeLength(files) {
  const violations = [];
  for (const f of files) {
    const lines = countLines(f);
    if (lines > LINE_LIMIT) violations.push({ file: f, lines });
  }
  return violations;
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2).map((p) => path.resolve(p)) : listSourceFiles();
  const violations = checkCodeLength(targets);
  if (violations.length === 0) {
    console.log(`코드 길이 검사 통과 (기준 ${LINE_LIMIT}줄, 대상 ${targets.length}개 파일)`);
    process.exit(0);
  }
  console.error(`코드 길이 기준(${LINE_LIMIT}줄) 초과 ${violations.length}건:`);
  for (const v of violations) {
    console.error(`  - ${path.relative(PROJECT_ROOT, v.file)}: ${v.lines}줄 (초과 ${v.lines - LINE_LIMIT}줄)`);
  }
  console.error(`\n압축이나 의미 없는 분할 대신, 책임 단위(예: 읽기/쓰기/진입점)로 나누는 걸 검토하세요.`);
  process.exit(1);
}
