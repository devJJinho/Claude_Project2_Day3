// Claude Code 로컬 세션 로그 파일 위치 조사 결과(T-029)를 코드로 반영.
//
// 조사 방법: 이 저장소의 T-029 작업을 수행한 실제 로컬 macOS 머신(사용자 본인 PC)에서
// `~/.claude/projects/` 아래를 직접 열어 확인했다(2026-09-17). 확인된 사실:
//   - 경로: ~/.claude/projects/<sanitized-cwd>/<sessionId>.jsonl
//     sanitized-cwd는 프로젝트 절대경로의 각 세그먼트 구분자를 '-'로 바꾼 이름으로 보이나,
//     특수문자(예: 이모지) 처리 규칙까지는 100% 특정하지 못했다 — 그래서 디렉터리 이름 매칭에
//     의존하지 않고, 항상 각 .jsonl 파일 내용의 `cwd` 필드로 대상 프로젝트를 판별한다(더 확실).
//   - 형식: JSON Lines. 한 줄에 하나의 이벤트. 관련 필드(2026-09-17 실측):
//       type: "user" | "assistant" | "attachment" | "mode" | ... (그 외 세션 메타 이벤트)
//       assistant 타입 라인에만: message.model, message.usage.{input_tokens,output_tokens,
//         cache_creation_input_tokens,cache_read_input_tokens,...}, requestId, timestamp,
//         cwd, sessionId, gitBranch
//   - 서브에이전트 로그는 <sessionId>/subagents/agent-*.jsonl 에 별도로 쌓인다(선택적으로
//     usage 집계에 포함할 수 있으나, 1차 구현에서는 최상위 세션 파일만 다룬다 — 서브에이전트
//     사용량까지 합산하는 것은 이후 확장 과제로 남긴다).
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function claudeProjectsRoot() {
  return path.join(homedir(), ".claude", "projects");
}

function listDirsSafe(dir) {
  try {
    return readdirSync(dir).filter((name) => {
      try {
        return statSync(path.join(dir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * ~/.claude/projects/ 아래 모든 최상위 세션 .jsonl 파일 목록을 찾는다. 디렉터리 이름의
 * sanitize 규칙을 추정해 특정 프로젝트로 미리 좁히지 않는다(특수문자 처리 규칙이 100%
 * 확실하지 않기 때문) — 대신 log-parser.mjs가 각 파일 내용의 실제 `cwd` 필드를 라인 단위로
 * 대조해 확실하게 매칭한다.
 * @returns {string[]} 매칭된 .jsonl 절대경로 목록(최상위 세션 파일만, subagents 제외)
 */
export function findSessionLogFiles() {
  const root = claudeProjectsRoot();
  const dirs = listDirsSafe(root);
  const matches = [];
  for (const dirName of dirs) {
    const dirPath = path.join(root, dirName);
    let entries;
    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      matches.push(path.join(dirPath, name));
    }
  }
  return matches; // cwd 대조는 log-parser.mjs가 라인 단위로 읽으며 함께 수행한다(파일을 두 번 읽지 않기 위함).
}
