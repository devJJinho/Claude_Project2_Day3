// 등록된 프로젝트의 로컬 backlog.json을 읽어 project_backlog_snapshot에 upsert한다(사용자
// 요청 2026-09-17: "실제 프로젝트가 연결됐음에도 backlog.json 내용이 웹에서 안 보인다").
//
// 이 파일은 Claude Code의 backlog-cli.mjs를 거치지 않고 fs로 직접 읽는다 — 이건 그 프로젝트
// 안에서 실행되는 Claude Code 세션의 "도구 호출"이 아니라, 완전히 별도의 로컬 에이전트
// 프로세스가 하는 조회 전용 읽기이므로 require-backlog-cli.mjs 훅(PreToolUse) 대상이 아니다
// (그 훅은 Claude Code 세션 안에서의 Read/Edit/Write/Bash만 가로챈다).
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { getLastBacklogHash, setLastBacklogHash } from "./poll-state.mjs";

function hashOf(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * @param {string} projectDir
 * @returns {{project: string|null, tasks: object[]}|null} 파일이 없거나 JSON이 아니면 null.
 */
export function readLocalBacklog(projectDir) {
  const backlogPath = path.join(projectDir, "backlog.json");
  if (!existsSync(backlogPath)) return null;
  const raw = readFileSync(backlogPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  return { raw, project: typeof data?.project === "string" ? data.project : null, tasks };
}

/**
 * @param {string} projectId
 * @param {string} projectDir
 * @returns {Promise<{synced:boolean, reason?:string}>}
 */
export async function syncBacklogForProject(projectId, projectDir) {
  const parsed = readLocalBacklog(projectDir);
  if (!parsed) return { synced: false, reason: "backlog.json이 없거나 유효한 JSON이 아닙니다." };

  const hash = hashOf(parsed.raw);
  if (hash === getLastBacklogHash(projectId)) {
    return { synced: false, reason: "이전과 내용이 같음(변경 없음)" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLES.BACKLOG_SNAPSHOT).upsert(
    {
      project_id: projectId,
      project_name: parsed.project,
      source_hash: hash,
      tasks: parsed.tasks,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) throw new Error(`project_backlog_snapshot upsert 실패: ${error.message}`);

  setLastBacklogHash(projectId, hash);
  return { synced: true };
}
