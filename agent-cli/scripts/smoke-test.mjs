#!/usr/bin/env node
// 네트워크/tmux/Supabase 없이 확인 가능한 순수 로직만 검증하는 수동 스모크 테스트.
// npm 테스트 러너를 새로 들이지 않고(불필요한 의존성 최소화), node로 바로 실행해 assert만 쓴다.
// 실행: node scripts/smoke-test.mjs
import assert from "node:assert/strict";
import { evaluateBashCommand } from "../src/guard-hook-logic.mjs";
import { mapAskUserQuestionAnswer, mapPermissionDecision, UnrecognizedResponseError } from "../src/key-mapping.mjs";
import { collectUsageForProject } from "../src/log-parser.mjs";
import { mergeHook } from "../src/settings-writer.mjs";
import { buildHooksToInstall } from "../src/hook-delegate-template.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check("guard-hook-logic: rm -rf 차단", () => {
  assert.equal(evaluateBashCommand("rm -rf /tmp/x").denied, true);
});
check("guard-hook-logic: 일반 명령 통과", () => {
  assert.equal(evaluateBashCommand("ls -la").denied, false);
});
check("guard-hook-logic: 히어독 안 문구는 오탐 안 함", () => {
  assert.equal(evaluateBashCommand('git commit -m "$(cat <<\'EOF\'\nrm -rf 언급\nEOF\n)"').denied, false);
});

check("key-mapping: AskUserQuestion 유효 인덱스", () => {
  assert.deepEqual(mapAskUserQuestionAnswer(2), ["2", "Enter"]);
});
check("key-mapping: AskUserQuestion 범위 밖 거부", () => {
  assert.throws(() => mapAskUserQuestionAnswer(99), UnrecognizedResponseError);
});
check("key-mapping: 문자열/자유 텍스트 거부", () => {
  assert.throws(() => mapAskUserQuestionAnswer("rm -rf /"), UnrecognizedResponseError);
});
check("key-mapping: Permission 화이트리스트만 허용", () => {
  assert.deepEqual(mapPermissionDecision("deny"), ["3", "Enter"]);
  assert.throws(() => mapPermissionDecision("yes_please"), UnrecognizedResponseError);
});

check("settings-writer: 같은 훅 재삽입해도 중복 안 됨", () => {
  const hooks = buildHooksToInstall(["guard"]);
  let settings = { hooks: {} };
  settings = mergeHook(settings, hooks[0].eventName, hooks[0].matcher, hooks[0].hookEntry);
  settings = mergeHook(settings, hooks[0].eventName, hooks[0].matcher, hooks[0].hookEntry);
  assert.equal(settings.hooks.PreToolUse.length, 1);
  assert.equal(settings.hooks.PreToolUse[0].hooks.length, 1);
});

const usageRecords = await collectUsageForProject(
  "/Users/jinho/Documents/01_Personal🚨/11_SDC/04_Claude_Vibe/Day_4_SDC_Project"
);
check("log-parser: 실제 ~/.claude/projects 로그에서 usage 레코드 추출(T-029 근거 파일)", () => {
  assert.ok(usageRecords.length > 0, "실제 세션 로그에서 usage 레코드를 하나도 못 찾음");
  assert.ok(usageRecords[0].model, "model 필드 누락");
  assert.ok(typeof usageRecords[0].inputTokens === "number");
});

console.log(`\n총 ${passed}개 통과 (usage 레코드 ${usageRecords.length}건 실측)`);
