#!/usr/bin/env node
// PostToolUse(Edit|Write) 훅: backlog.json이 수정된 경우에만 무결성을 검사한다.
// backlog.json에 쓰지 않는다 — 오직 읽고 stdout으로 JSON 판정만 출력한다.
// JSON 안의 어떤 문자열도 셸 명령/코드로 실행하지 않는다.
// 검증 규칙은 backlog-cli.mjs와 동일한 backlog-schema.mjs를 공유한다.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { validateBacklog } from "../tools/backlog-schema.mjs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function block(reason) {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

function pass() {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  pass(); // 훅 입력 자체가 비정상이면 조용히 통과 (이 훅의 책임 범위 밖)
}

const filePath = input?.tool_response?.filePath ?? input?.tool_input?.file_path ?? "";
if (basename(filePath) !== "backlog.json") {
  pass();
}

let raw;
try {
  raw = readFileSync(filePath, "utf8");
} catch (e) {
  block(`backlog.json을 읽을 수 없습니다: ${e.message}`);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  block(`backlog.json JSON 파싱 실패: ${e.message}. 방금 편집을 되돌리거나 문법 오류를 수정하세요.`);
}

const errors = validateBacklog(data);
if (errors.length > 0) {
  block(`backlog.json 무결성 오류 ${errors.length}건:\n- ` + errors.join("\n- "));
}

pass();
