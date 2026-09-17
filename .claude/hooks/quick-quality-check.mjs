#!/usr/bin/env node
// PostToolUse(Edit|Write) 훅: 방금 편집된 소스 파일 "한 개"에 대해서만 코드 길이 + lint를 즉시
// 검사한다(빠른 검사). build(node --check)는 전체 검사(Stop 훅)에서만 돈다.
// SOURCE_DIRS/SOURCE_EXTENSIONS에 해당하는 파일이 아니면 즉시 통과한다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SOURCE_DIRS, SOURCE_EXTENSIONS } from "../tools/quality-config.mjs";
import { checkCodeLength } from "../tools/check-code-length.mjs";
import { runLint } from "../tools/check-lint.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function block(reason) {
  process.stderr.write(reason + "\n");
  process.exit(2);
}

function isTrackedSource(absPath) {
  if (!SOURCE_EXTENSIONS.some((ext) => absPath.endsWith(ext))) return false;
  const rel = path.relative(PROJECT_ROOT, absPath);
  return SOURCE_DIRS.some((dir) => rel.startsWith(dir + path.sep));
}

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  process.exit(0);
}

const filePath = input?.tool_response?.filePath ?? input?.tool_input?.file_path ?? "";
const absPath = filePath ? path.resolve(filePath) : "";
if (!absPath || !isTrackedSource(absPath)) {
  process.exit(0);
}

const lengthViolations = checkCodeLength([absPath]);
if (lengthViolations.length > 0) {
  const v = lengthViolations[0];
  block(
    `코드 길이 기준(300줄) 초과: ${path.relative(PROJECT_ROOT, v.file)} — ${v.lines}줄. ` +
      `압축/의미 없는 분할 대신 책임 단위로 나누세요(예: 읽기/쓰기/진입점).`
  );
}

const lint = runLint([absPath]);
if (lint.status === "NOT_CONFIGURED") {
  block(`lint 도구가 설정돼 있지 않습니다(NOT_CONFIGURED): ${lint.output}`);
}
if (lint.status === "TIMEOUT") {
  block(`lint가 시간 초과로 끝나지 않았습니다 — 미검증 상태이며 통과로 취급하지 않습니다: ${lint.output}`);
}
if (lint.status === "FAIL") {
  block(`lint 위반: ${path.relative(PROJECT_ROOT, absPath)}\n${lint.output}`);
}

process.exit(0);
