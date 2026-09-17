#!/usr/bin/env node
// Stop 훅: 전체 소스에 대해 코드 길이 + lint + build(문법 검사)를 순서대로 돌린다.
//
// 동기 실행 규약: 실패 시 exit code 2 + stderr에 구체적 수정 안내를 담아 Claude가 이어서
// 고치도록 요청한다(JSON 출력이 아니라 원시 exit code 2 규약).
//
// stop_hook_active 처리: 무한 재진입 루프를 막기 위해, 이미 한 번 이 Stop 훅이 막아서 재진입한
// 상태(stop_hook_active=true)인데도 여전히 실패하면 더 이상 exit 2로 다시 막지 않는다(그러지
// 않으면 영원히 반복될 수 있음). 그렇다고 이걸 "통과"로 취급하지는 않는다 — systemMessage로
// 여전히 실패 중이라는 사실과 남은 조치를 명시적으로 알리고 exit 0으로 종료를 허용한다.
//
// 타임아웃: 개별 검사(build의 각 파일별 node --check, lint 전체)는 INNER_CHECK_TIMEOUT_MS로
// 제한한다. 이 값은 settings.json에 설정한 이 훅 자체의 timeout보다 반드시 짧아야 하며, 바깥
// hook timeout에 의한 강제 종료에 기대지 않는다. 시간 초과는 TIMEOUT으로 보고하며 통과 근거로
// 쓰지 않는다.

import { readFileSync } from "node:fs";
import { checkCodeLength, listSourceFiles } from "../tools/check-code-length.mjs";
import { runLint } from "../tools/check-lint.mjs";
import { runBuildCheck } from "../tools/check-build.mjs";
import { LINE_LIMIT } from "../tools/quality-config.mjs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function runAllChecks() {
  const results = [];

  const files = listSourceFiles();
  const lengthViolations = checkCodeLength(files);
  results.push({
    name: "code-length",
    status: lengthViolations.length === 0 ? "PASS" : "FAIL",
    detail:
      lengthViolations.length === 0
        ? `기준 ${LINE_LIMIT}줄, ${files.length}개 파일 모두 통과`
        : lengthViolations.map((v) => `${v.file}: ${v.lines}줄(초과 ${v.lines - LINE_LIMIT})`).join("\n"),
  });

  const lint = runLint();
  results.push({ name: "lint(oxlint)", status: lint.status, detail: lint.output || "(출력 없음)" });

  const build = runBuildCheck();
  const buildOk = build.failures.length === 0 && build.timeouts.length === 0;
  results.push({
    name: "build(node --check)",
    status: buildOk ? "PASS" : build.timeouts.length > 0 ? "TIMEOUT" : "FAIL",
    detail: buildOk
      ? `${build.files.length}개 파일 문법 검사 통과 (이 스택엔 별도 빌드 산출물 단계가 없어 문법 검사로 대체)`
      : [...build.failures.map((f) => `${f.file}\n${f.stderr}`), ...build.timeouts.map((f) => `TIMEOUT: ${f}`)].join("\n\n"),
  });

  return results;
}

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  input = {};
}
const stopHookActive = input?.stop_hook_active === true;

const results = runAllChecks();
const failed = results.filter((r) => r.status !== "PASS");

if (failed.length === 0) {
  process.exit(0);
}

const report = failed
  .map((r) => `[${r.name}] ${r.status}\n${r.detail}`)
  .join("\n\n");

if (!stopHookActive) {
  console.error(
    `전체 검증 실패 (${failed.length}건) — 완료 처리 전에 고쳐야 합니다:\n\n${report}\n\n` +
      `수정 후 다시 시도하면 이 훅이 재검증합니다.`
  );
  process.exit(2);
}

// 재진입 상태에서도 여전히 실패 — 무한 루프를 막기 위해 더 이상 막지는 않지만, 통과로 위장하지
// 않고 사용자에게 명확히 실패 상태를 남긴다.
console.log(
  JSON.stringify({
    systemMessage:
      `검증 재시도 후에도 여전히 실패 상태입니다 (${failed.length}건) — 무한 재작업 루프를 막기 위해 ` +
      `더 이상 자동으로 막지 않고 종료를 허용합니다. 완료된 것으로 간주하지 마세요. 실패 내역:\n\n${report}`,
  })
);
process.exit(0);
