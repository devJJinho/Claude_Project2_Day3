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
import { resolveInjectionInput } from "../src/response-resolver.mjs";

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
check("key-mapping: Permission 화이트리스트만 허용(approve/deny)", () => {
  // 2026-09-17 실측: 옵션 번호(2/3/4)는 프롬프트 구성에 따라 달라져 deny를 숫자로 고정하면
  // "항상 허용" 같은 다른 옵션을 잘못 누를 수 있다 — deny는 옵션 구성과 무관한 Esc로 고정한다.
  assert.deepEqual(mapPermissionDecision("approve"), ["1", "Enter"]);
  assert.deepEqual(mapPermissionDecision("deny"), ["Escape"]);
  assert.throws(() => mapPermissionDecision("allow_always"), UnrecognizedResponseError);
});

check("response-resolver: ask_user_question choice → optionIndex", () => {
  const event = { type: "ask_user_question", payload: { question: "q", options: ["A", "B", "C"] } };
  assert.deepEqual(resolveInjectionInput({ choice: "B" }, event), { type: "ask_user_question", optionIndex: 2 });
});
check("response-resolver: 이벤트 옵션에 없는 choice는 거부", () => {
  const event = { type: "ask_user_question", payload: { question: "q", options: ["A", "B"] } };
  assert.throws(() => resolveInjectionInput({ choice: "Z" }, event), UnrecognizedResponseError);
});
check("response-resolver: permission choice는 decision으로 그대로 전달", () => {
  const event = { type: "permission", payload: { tool: "Bash", command: "rm x" } };
  assert.deepEqual(resolveInjectionInput({ choice: "approve" }, event), { type: "permission", decision: "approve" });
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
