// 로컬 세션 로그(.jsonl) 파싱(T-030). log-locator.mjs가 찾은 파일들을 한 줄씩 읽으며
// type==="assistant"인 라인만 골라 토큰 사용량 레코드로 변환한다. 대용량 로그 파일을 한 번에
// 메모리에 올리지 않도록 readline 스트림을 사용한다.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { findSessionLogFiles } from "./log-locator.mjs";

/**
 * @param {object} line 파싱된 JSONL 한 줄(type==="assistant")
 * @returns {object|null} usage 레코드, usage 필드가 없으면 null
 */
function toUsageRecord(line) {
  const usage = line?.message?.usage;
  if (!usage) return null;
  return {
    sessionId: line.sessionId ?? null,
    requestId: line.requestId ?? null,
    uuid: line.uuid ?? null,
    timestamp: line.timestamp ?? null,
    cwd: line.cwd ?? null,
    gitBranch: line.gitBranch ?? null,
    model: line.message?.model ?? null,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

/**
 * 한 개의 .jsonl 파일에서 usage 레코드를 모두 뽑는다.
 * @param {string} filePath
 * @param {{cwdFilter?: string}} opts cwdFilter를 주면 그 cwd와 일치하는 라인만 반환
 * @returns {Promise<object[]>}
 */
export async function parseUsageFromLogFile(filePath, opts = {}) {
  const records = [];
  const rl = createInterface({ input: createReadStream(filePath, "utf8"), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (!raw.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue; // 손상된 줄은 건너뛴다(로그 파일이 쓰는 도중일 수 있음 — 전체를 실패시키지 않음)
    }
    if (obj.type !== "assistant") continue;
    if (opts.cwdFilter && obj.cwd !== opts.cwdFilter) continue;
    const record = toUsageRecord(obj);
    if (record) records.push(record);
  }
  return records;
}

/**
 * 특정 프로젝트(cwd)에 해당하는 모든 세션 로그 파일에서 usage 레코드를 모아 반환한다.
 * @param {string} projectCwd
 * @returns {Promise<object[]>}
 */
export async function collectUsageForProject(projectCwd) {
  const files = findSessionLogFiles();
  const all = [];
  for (const file of files) {
    const records = await parseUsageFromLogFile(file, { cwdFilter: projectCwd });
    all.push(...records);
  }
  return all;
}
