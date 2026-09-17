// 프로젝트별 로컬 런타임 상태(워터마크) 저장소. ~/.claudebridge/config.json(설정)과 분리해
// 자주 갱신되는 값을 따로 둔다(책임 분리).
//
// 두 군데서 쓴다:
//  1) responses-poller.mjs(T-018) — responses 테이블에 consumed 같은 처리 플래그 컬럼이
//     없어서(schema-contract.mjs 참고) "마지막으로 처리한 응답의 created_at"을 로컬에 기억.
//  2) usage-logs.mjs(T-031) — usage_logs 테이블에도 (project_id, request_id) 같은 유니크
//     제약이 없다(web-app 트랙 실제 마이그레이션 확인 — id uuid PK뿐). 로그 파일 전체를 다시
//     파싱해 매번 그대로 insert하면 동기화할 때마다 중복 행이 쌓이므로, "마지막으로 적재한
//     로그 레코드의 timestamp"를 기억해 그 이후 것만 올린다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const STATE_DIR = path.join(homedir(), ".claudebridge", "state");
const EPOCH = new Date(0).toISOString();

function statePath(projectId) {
  return path.join(STATE_DIR, `${projectId}.json`);
}

function readState(projectId) {
  const p = statePath(projectId);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function writeState(projectId, state) {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(projectId), JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function getLastPolledAt(projectId) {
  return readState(projectId).lastPolledAt || EPOCH;
}

export function setLastPolledAt(projectId, iso) {
  writeState(projectId, { ...readState(projectId), lastPolledAt: iso });
}

export function getLastUsageSyncedAt(projectId) {
  return readState(projectId).lastUsageSyncedAt || EPOCH;
}

export function setLastUsageSyncedAt(projectId, iso) {
  writeState(projectId, { ...readState(projectId), lastUsageSyncedAt: iso });
}
