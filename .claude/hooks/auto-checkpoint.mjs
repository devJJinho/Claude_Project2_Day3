#!/usr/bin/env node
// Stop 훅(마지막 순서 — update-progress.mjs, full-quality-check.mjs 다음): 변경사항을
// 주기적으로 자동 커밋 + 푸시한다. LLM을 호출하지 않는 순수 스크립트라 토큰 비용이 없다.
//
// 이 자동화는 사용자가 명시적으로 요청한 지속 규칙(.claude/rules/commit-cadence.md)에
// 근거한다 — 이 훅 밖에서 Claude가 임의로 커밋/푸시하는 것까지 승인하는 것은 아니다.
//
// - 커밋 주기: 마지막 체크포인트 이후 COMMIT_INTERVAL_MIN 이상 지났고 실제 변경사항이 있을
//   때만 커밋한다(턴마다 커밋하지 않음 — "주기적으로"의 취지).
// - 푸시 주기: 커밋 성공 후, 마지막 푸시 이후 PUSH_INTERVAL_MIN 이상 지났으면 현재 브랜치를
//   push한다. force push는 절대 하지 않는다 — 실패(예: 충돌, 네트워크)해도 조용히 넘어간다.
// - full-quality-check.mjs가 먼저 실패(exit 2)하면 이 훅까지 도달하지 않으므로, 커밋되는
//   시점의 코드는 항상 길이/lint/build 검사를 통과한 상태다.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const COMMIT_INTERVAL_MIN = 15;
const PUSH_INTERVAL_MIN = 30;

function tryRun(cmd, args, opts) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", ...opts }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

function loadState(statePath) {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return { lastCommitAt: 0, lastPushAt: 0 };
  }
}

/** HEAD와 워킹트리의 backlog.json을 비교해 상태가 바뀐 태스크 id를 요약한다(커밋 메시지용). */
function summarizeBacklogChanges(root) {
  const head = tryRun("git", ["show", "HEAD:backlog.json"], { cwd: root });
  if (!head.ok) return null;
  let headTasks, curTasks;
  try {
    headTasks = JSON.parse(head.out).tasks;
    curTasks = JSON.parse(readFileSync(path.join(root, "backlog.json"), "utf8")).tasks;
  } catch {
    return null;
  }
  const prevStatus = new Map(headTasks.map((t) => [t.id, t.status]));
  const changes = [];
  for (const t of curTasks) {
    const prev = prevStatus.get(t.id);
    if (prev === undefined) changes.push(`${t.id}:신규`);
    else if (prev !== t.status) changes.push(`${t.id}:${prev}→${t.status}`);
  }
  return changes.length > 0 ? changes.join(", ") : null;
}

function main() {
  const rootRes = tryRun("git", ["rev-parse", "--show-toplevel"]);
  if (!rootRes.ok) return; // git 저장소가 아니면 아무것도 하지 않는다
  const root = rootRes.out.trim();

  const statusRes = tryRun("git", ["status", "--porcelain"], { cwd: root });
  if (!statusRes.ok || statusRes.out.trim() === "") return; // 변경사항 없음

  const statePath = path.join(root, ".claude", ".checkpoint-state.json");
  const state = loadState(statePath);
  const now = Date.now();

  if ((now - state.lastCommitAt) / 60000 < COMMIT_INTERVAL_MIN) return; // 아직 주기 안 됨

  const branchRes = tryRun("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
  const branch = branchRes.ok ? branchRes.out.trim() : "HEAD";
  if (branch === "HEAD") return; // detached HEAD 등 예외 상태에서는 건드리지 않는다

  const backlogSummary = summarizeBacklogChanges(root);
  const message = backlogSummary
    ? `체크포인트: ${backlogSummary}`
    : `체크포인트: ${new Date(now).toISOString()} 기준 자동 저장`;

  if (!tryRun("git", ["add", "-A"], { cwd: root }).ok) return;
  const commitRes = tryRun(
    "git",
    ["commit", "-m", `${message}\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`],
    { cwd: root }
  );
  if (!commitRes.ok) return; // 예: 스테이징된 실질 변경이 없어 커밋할 게 없는 경우

  state.lastCommitAt = now;

  if ((now - state.lastPushAt) / 60000 >= PUSH_INTERVAL_MIN) {
    const pushRes = tryRun("git", ["push", "origin", branch], { cwd: root });
    if (pushRes.ok) state.lastPushAt = now;
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

main();
process.exit(0);
