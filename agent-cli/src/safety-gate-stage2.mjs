// 안전 게이트 2단계(T-047): 1단계(위험 명령어 차단)를 통과한 뒤에만 호출된다는 전제 하에,
// "웹에서 실제로 이 세션에 접근해 조작할 수 있는 상태인지"를 점검한다(개발요청서.md I 항목).
// 세 가지를 확인한다: (1) tmux 세션 존재, (2) 로컬 에이전트 → Supabase 연결 가능, (3) 그
// tmux 세션 안에서 Claude Code로 보이는 프로세스가 실제로 돌고 있는지.
import { spawnSync } from "node:child_process";
import { hasSession, isTmuxAvailable } from "./tmux-session.mjs";
import { getSupabaseServiceCredentials } from "./config.mjs";

const SUPABASE_PING_TIMEOUT_MS = 5000;

function checkTmux(sessionName) {
  if (!isTmuxAvailable()) return { ok: false, reason: "tmux 실행 파일을 찾을 수 없습니다." };
  if (!hasSession(sessionName)) {
    return { ok: false, reason: `tmux 세션(${sessionName})이 존재하지 않습니다.` };
  }
  return { ok: true, reason: `tmux 세션(${sessionName}) 존재 확인` };
}

function checkClaudeProcessInSession(sessionName) {
  const r = spawnSync("tmux", ["list-panes", "-t", sessionName, "-F", "#{pane_current_command}"], {
    encoding: "utf8",
  });
  if (r.error || r.status !== 0) {
    return { ok: false, reason: `세션(${sessionName}) 상태를 조회할 수 없습니다.` };
  }
  const commands = r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  // "claude" CLI(node로 실행되는 경우도 있음)를 실행 중인 pane이 하나라도 있으면 통과로 본다.
  // 정확한 프로세스명은 설치 방식에 따라 다를 수 있어 claude/node 둘 다 허용하는 휴리스틱이다.
  const looksLikeClaude = commands.some((c) => /claude|node/i.test(c));
  if (!looksLikeClaude) {
    return {
      ok: false,
      reason: `세션(${sessionName})의 pane에서 Claude Code로 보이는 프로세스를 찾지 못했습니다(pane_current_command=${commands.join(",")}).`,
    };
  }
  return { ok: true, reason: "세션 내 Claude Code 프로세스로 추정되는 pane 확인" };
}

async function checkSupabaseReachable() {
  const { url, serviceRoleKey } = getSupabaseServiceCredentials();
  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      reason:
        "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      signal: controller.signal,
    });
    // PostgREST 루트는 인증이 유효하면 200/404 등을 반환한다 — 여기서는 "요청이 응답을
    // 받았다(=네트워크와 인증 형식이 살아있다)"만 확인하고, 세부 스키마는 다루지 않는다.
    return { ok: res.status < 500, reason: `Supabase REST 응답 status=${res.status}` };
  } catch (err) {
    return { ok: false, reason: `Supabase 연결 실패: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * sessionName을 생략하면(예: claudebridge init이 tmux 세션을 만들기 전 사전 점검 단계)
 * "특정 세션이 이미 떠 있는지"는 확인할 수 없으므로 tmux 실행 파일 존재 여부 + Supabase
 * 연결만 확인한다(더 가벼운 프리플라이트 모드). 세션명이 있으면(데몬 재시작 시 재검증,
 * T-047 원래 용도) 세 가지를 모두 확인한다.
 * @param {string} [sessionName]
 * @returns {Promise<{passed: boolean, checks: Record<string, {ok:boolean, reason:string}>}>}
 */
export async function checkStage2WebAccess(sessionName) {
  const supabase = await checkSupabaseReachable();
  if (!sessionName) {
    const tmux = { ok: isTmuxAvailable(), reason: isTmuxAvailable() ? "tmux 실행 파일 확인" : "tmux 실행 파일을 찾을 수 없습니다." };
    const checks = { tmux, supabase };
    return { passed: Object.values(checks).every((c) => c.ok), checks };
  }
  const tmux = checkTmux(sessionName);
  const claudeProcess = tmux.ok ? checkClaudeProcessInSession(sessionName) : { ok: false, reason: "tmux 세션이 없어 확인 불가" };
  const checks = { tmux, claudeProcess, supabase };
  const passed = Object.values(checks).every((c) => c.ok);
  return { passed, checks };
}
