// backlog.json 검증/해시 로직 — CLI(backlog-cli.mjs)와 훅(check-backlog-integrity.mjs)이
// 같은 규칙을 공유하기 위한 순수 함수 모음. 여기서 어떤 문자열도 실행(eval/exec)하지 않는다.

import { createHash } from "node:crypto";

// needs_info: 사람의 결정이 필요해 멈춘 상태(예: 요구사항 모호, 선택지 확인 필요).
// blocked와 구분: blocked는 다른 작업(T-026처럼)이 끝나야 풀리는 상태, needs_info는 사람의
// "답변" 자체가 필요한 상태.
export const VALID_STATUS = new Set(["todo", "doing", "done", "blocked", "needs_info"]);

// 개발요청서.md(A~L 섹션)의 기능 범위에서 유도한 카테고리 집합. 고정 스키마 파일이 없어
// 요구사항 문서로부터 초기값을 정의했다 — 실제 개발 중 범위가 바뀌면 여기도 갱신할 것.
export const KNOWN_CATEGORIES = new Set([
  "infra", // H. 프로젝트 셋업/배포(Next.js/Vercel/Supabase 프로젝트 생성)
  "backend", // D,G. Supabase 스키마(projects/blocked_events/responses/usage_logs)
  "auth", // C. 구글 로그인 + 화이트리스트
  "agent", // A,B. 로컬 에이전트(hooks 감지, 폴링, tmux 주입)
  "dashboard", // 웹 대시보드 UI(상태/응답/토큰 사용량 뷰)
  "usage", // E. 토큰 사용량 파싱/집계
  "notify", // F. 웹 푸시 알림
  "security", // I. 보안(키 관리, 화이트리스트, 임의 명령 주입 차단)
  "qa", // J. end-to-end 검증
  "docs", // 3장. 다른 프로젝트 이식 가이드
]);

// 실제 28개 id가 전부 따르는 형식(T-001..T-028)에서 유도한 패턴.
export const ID_PATTERN = /^T-\d{3}$/;

export function hashOf(rawText) {
  return createHash("sha256").update(rawText, "utf8").digest("hex");
}

/**
 * @param {object} data 파싱된 backlog.json
 * @returns {string[]} 오류 목록 (빈 배열이면 유효)
 */
export function validateBacklog(data) {
  const errors = [];
  const tasks = Array.isArray(data?.tasks) ? data.tasks : null;

  if (tasks === null) {
    errors.push("최상위 'tasks' 필드가 배열이 아닙니다.");
    return errors;
  }

  const ids = new Set();
  for (const t of tasks) {
    if (typeof t.id !== "string" || t.id === "") {
      errors.push("id가 없거나 문자열이 아닌 태스크가 있습니다.");
      continue;
    }
    if (ids.has(t.id)) {
      errors.push(`중복된 id '${t.id}'가 있습니다.`);
    }
    ids.add(t.id);

    if (!VALID_STATUS.has(t.status)) {
      errors.push(
        `태스크 '${t.id}'의 status 값 '${t.status}'이(가) 허용된 값(${[...VALID_STATUS].join("/")})이 아닙니다.`
      );
    }

    if ((t.status === "blocked" || t.status === "needs_info") && !t.note) {
      errors.push(`태스크 '${t.id}'는 status가 ${t.status}인데 note가 없습니다(blocked=보류 사유, needs_info=사람에게 물어볼 질문 필요).`);
    }
  }

  for (const t of tasks) {
    for (const dep of t.deps ?? []) {
      if (!ids.has(dep)) {
        errors.push(`태스크 '${t.id}'의 deps가 존재하지 않는 id '${dep}'를 참조합니다.`);
      }
    }
    if (t.parent != null && !ids.has(t.parent)) {
      errors.push(`태스크 '${t.id}'의 parent가 존재하지 않는 id '${t.parent}'를 참조합니다.`);
    }
  }

  return errors;
}

/**
 * deps 그래프에 사이클이 있는지 검사한다(새 태스크를 포함한 상태로 호출).
 * @param {Array<{id:string, deps?:string[]}>} tasks
 * @returns {string[]|null} 사이클을 이루는 id 경로, 없으면 null
 */
export function findDependencyCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t.deps ?? []]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...byId.keys()].map((id) => [id, WHITE]));
  const stack = [];

  function visit(id) {
    color.set(id, GRAY);
    stack.push(id);
    for (const dep of byId.get(id) ?? []) {
      if (!byId.has(dep)) continue; // 존재하지 않는 참조는 validateBacklog가 별도로 보고
      const c = color.get(dep);
      if (c === GRAY) {
        return [...stack.slice(stack.indexOf(dep)), dep];
      }
      if (c === WHITE) {
        const cyc = visit(dep);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const id of byId.keys()) {
    if (color.get(id) === WHITE) {
      const cyc = visit(id);
      if (cyc) return cyc;
    }
  }
  return null;
}
