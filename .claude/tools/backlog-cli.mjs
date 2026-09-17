#!/usr/bin/env node
// backlog.json 조회·작업 추가·상태 수정 CLI 진입점. 외부 패키지 없이 Node 내장 모듈만 사용한다.
// 실제 로직은 backlog-queries.mjs(읽기)/backlog-mutations.mjs(쓰기)에 있다 — 이 파일은
// 인자 파싱과 명령 라우팅만 담당한다.
// JSON 안의 어떤 문자열도(예: 가상의 'gate' 필드) 명령으로 실행하지 않는다 — 조건은 전부 코드에 하드코딩.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashOf, validateBacklog } from "./backlog-schema.mjs";
import { cmdList, cmdShow, cmdReady } from "./backlog-queries.mjs";
import { cmdAdd, cmdSetStatus, cmdSetDeps, cmdInit } from "./backlog-mutations.mjs";
import { CliError } from "./backlog-errors.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DEFAULT_BACKLOG_PATH = path.join(PROJECT_ROOT, "backlog.json");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadBacklog(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (e) {
    throw new CliError(`backlog 파일을 읽을 수 없습니다 (${filePath}): ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new CliError(`backlog 파일이 유효한 JSON이 아닙니다 (${filePath}): ${e.message}`);
  }
  const errors = validateBacklog(data);
  if (errors.length > 0) {
    throw new CliError(`backlog 스키마 오류 ${errors.length}건:\n- ` + errors.join("\n- "));
  }
  return { data, raw, hash: hashOf(raw) };
}

function usage() {
  return [
    "사용법: node .claude/tools/backlog-cli.mjs <command> [옵션]",
    "",
    "초기화(최초 1회, backlog.json이 없을 때만):",
    '  init [--project "<이름>"] [--source "<요구사항 문서 파일명>"]',
    "",
    "읽기 전용:",
    "  list [--status <s>] [--category <c>] [--json]",
    "  show <id>",
    "  ready [--json]                # status=todo && 모든 deps가 done인 진행 후보",
    "",
    "변경(명시적 서브명령만):",
    '  add --title "<t>" --category <c> --source-section <s> [--status <s>] [--deps id,id] [--parent id] [--note "<n>"] [--id T-0NN]',
    '  set-status <id> <새 상태> [--evidence "<완료 근거>"] [--note "<메모>"] [--if-hash <hash>]',
    '  set-deps <id> --deps id1,id2 (없애려면 --deps "") [--if-hash <hash>]',
    "",
    "공통: --file <path>  (기본: 프로젝트의 backlog.json)",
  ].join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._.shift();
  const filePath = args.file && args.file !== true ? path.resolve(args.file) : DEFAULT_BACKLOG_PATH;

  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    return;
  }

  if (command === "init") {
    return cmdInit(args, filePath, existsSync);
  }

  if (!existsSync(filePath)) {
    throw new CliError(`backlog 파일이 없습니다: ${filePath}. 최초 1회 'init'으로 생성하세요.`);
  }

  const ctx = loadBacklog(filePath);

  switch (command) {
    case "list":
      return cmdList(args, ctx);
    case "show":
      return cmdShow(args, ctx);
    case "ready":
      return cmdReady(args, ctx);
    case "add":
      return cmdAdd(args, ctx, filePath);
    case "set-status":
      return cmdSetStatus(args, ctx, filePath);
    case "set-deps":
      return cmdSetDeps(args, ctx, filePath);
    default:
      throw new CliError(`알 수 없는 명령입니다: '${command}'\n\n` + usage());
  }
}

try {
  main();
} catch (e) {
  if (e instanceof CliError) {
    console.error(`오류: ${e.message}`);
    process.exit(1);
  }
  console.error(`예상치 못한 오류: ${e.stack}`);
  process.exit(1);
}
