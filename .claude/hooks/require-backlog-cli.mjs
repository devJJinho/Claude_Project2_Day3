#!/usr/bin/env node
// PreToolUse(Read|Grep|Bash|Edit|Write) 훅: 기준 backlog.json을 "직접" 읽거나 쓰는 시도를 막고
// 검증된 backlog-cli.mjs 조회/변경 명령을 쓰도록 안내한다.
//
// 적용 범위(정직하게 명시):
// - Read/Edit/Write 툴로 backlog.json을 직접 여는/쓰는 것은 확실히 막는다(경로 정규화 포함).
// - Grep은 backlog.json 단독을 대상으로 지정한 경우만 막는다. 저장소 전체를 검색하다가
//   우연히 backlog.json 안의 문자열이 매칭되는 경우까지는 막지 못한다(범용 검색을 깨지
//   않기 위한 절충).
// - Bash는 cat/less/head/tail/jq/python/node/perl 등 "흔한" 직접 읽기 패턴과, echo 리디렉션/
//   sed -i/cp 등 "흔한" 직접 쓰기 패턴만 정규식으로 차단하는 휴리스틱이다. base64 인코딩,
//   심볼릭 링크 경유, 파일을 다른 이름으로 복사한 뒤 읽거나 쓰기 등 임의의 우회는 막지 못한다
//   — 이것은 임의 셸 코드의 모든 우회를 막는 보안 경계가 아니다.
// - backlog-cli.mjs 자신의 호출(내부적으로 이 파일을 Node fs로 읽고 쓰는 것)은 Claude Code의
//   툴 이벤트가 아니라 별도 프로세스이므로애초에 이 훅의 대상이 아니다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// NFC로 정규화: macOS는 한글 등이 포함된 경로를 파일시스템에서 NFD(분해형)로 돌려주는데,
// 소스 코드의 문자열 리터럴은 NFC(조합형)라 정규화 없이 비교하면 육안상 같은 경로도
// 항상 불일치로 판정되는 버그가 있었다(이 프로젝트 폴더명 자체가 한글이라 실제로 발생).
function normPath(p) {
  return path.resolve(p).normalize("NFC");
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = normPath(path.resolve(SCRIPT_DIR, "..", ".."));
const DEFAULT_TARGET = path.join(PROJECT_ROOT, "backlog.json");
// 테스트 시 격리된 사본을 대상으로 지정하기 위한 오버라이드. 운영 설정(settings.json)에는
// 이 환경변수를 심지 않으므로 평소에는 항상 실제 프로젝트의 backlog.json을 가리킨다.
const TARGET = normPath(process.env.BACKLOG_GUARD_TARGET || DEFAULT_TARGET);

const CLI_HINT = [
  "backlog.json은 직접 읽거나 쓰지 않고 검증된 CLI로 조회/변경합니다:",
  "  node .claude/tools/backlog-cli.mjs list / show <id> / ready   (읽기 전용)",
  "  node .claude/tools/backlog-cli.mjs add ...                    (작업 추가)",
  "  node .claude/tools/backlog-cli.mjs set-status <id> <상태> ...  (상태 변경)",
  "  node .claude/tools/backlog-cli.mjs set-deps <id> --deps ...    (deps 변경)",
  "CLI가 없거나 오류가 나면 `node .claude/tools/backlog-cli.mjs help`로 먼저 상태를 확인하세요.",
  "(우회해서 직접 열거나 고치지 말고, CLI 자체를 고치거나 이 메시지를 사용자에게 보고하세요.)",
].join("\n");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function allow() {
  process.exit(0);
}

function denyPreToolUse(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${reason}\n\n${CLI_HINT}`,
      },
    })
  );
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  allow();
}

const toolName = input?.tool_name;
// backlog-cli.mjs 자신을 실행하는 Bash 호출은 절대 막지 않는다(파일명이 인자에 등장해도).
const CLI_INVOCATION = /backlog-cli\.mjs/;

if (toolName === "Read") {
  const filePath = input?.tool_input?.file_path ?? "";
  if (filePath && normPath(filePath) === TARGET) {
    denyPreToolUse(`backlog.json 직접 읽기는 차단됩니다: ${filePath}`);
  }
  allow();
}

if (toolName === "Edit" || toolName === "Write") {
  const filePath = input?.tool_input?.file_path ?? "";
  if (filePath && normPath(filePath) === TARGET) {
    denyPreToolUse(`backlog.json 직접 ${toolName === "Edit" ? "수정" : "쓰기"}은 차단됩니다: ${filePath}`);
  }
  allow();
}

if (toolName === "Grep") {
  const grepPath = input?.tool_input?.path;
  const glob = input?.tool_input?.glob;
  const targetsOnlyBacklog =
    (grepPath && normPath(grepPath) === TARGET) ||
    (glob === "backlog.json" && (!grepPath || normPath(grepPath) === PROJECT_ROOT));
  if (targetsOnlyBacklog) {
    denyPreToolUse(`backlog.json만을 대상으로 한 검색은 차단됩니다.`);
  }
  allow();
}

if (toolName === "Bash") {
  const command = input?.tool_input?.command ?? "";
  if (CLI_INVOCATION.test(command)) {
    allow(); // 우리 CLI 자신의 실행은 절대 차단하지 않는다.
  }
  const DIRECT_ACCESS_PATTERNS = [
    /\b(cat|less|more|head|tail|bat|nl|od|xxd|hexdump|strings|sed|awk|view)\b[^\n]*\bbacklog\.json\b/,
    /\b(grep|rg|ag)\b[^\n]*\bbacklog\.json\b/,
    /\bjq\b[^\n]*\bbacklog\.json\b/,
    /\b(python3?|node|perl|ruby)\b[^\n]*\bbacklog\.json\b/,
    /<\s*[^\s]*\bbacklog\.json\b/,
    /\bdd\b[^\n]*if=[^\n]*\bbacklog\.json\b/,
    />>?\s*[^\s]*\bbacklog\.json\b/, // 리디렉션으로 직접 쓰기
    /\b(cp|mv|tee|rsync)\b[^\n]*\bbacklog\.json\b/, // 복사/이동/tee로 우회 쓰기
  ];
  if (DIRECT_ACCESS_PATTERNS.some((re) => re.test(command))) {
    denyPreToolUse(`Bash로 backlog.json을 직접 읽거나 쓰는 것으로 보이는 명령이 차단됩니다: ${command}`);
  }
  allow();
}

allow();
