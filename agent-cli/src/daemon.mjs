// `claudebridge run`(로컬 상주 에이전트 본체). 특정 프로젝트 디렉터리에서 실행되어:
//   1) 부팅 시퀀스(안전 게이트 1→2단계, 매 재시작마다 재검증 — 개발요청서.md I 항목)
//   2) responses 폴링 → tmux 응답 주입(T-018, T-020, T-021)
//   3) 주기적 토큰 사용량 동기화(T-031)
// 를 담당한다. claudebridge init이 자동으로 이 프로세스를 시작하지는 않는다(init은 tmux
// 세션 안에서 Claude Code만 실행) — 데몬은 사용자가 별도 터미널(또는 launchd/systemd 등)에서
// `claudebridge run`으로 상주시키는 것을 전제로 한다. 이 결정과 "프로세스 상주 방식"은
// README.md에 명시하고, 자동 상주화(로그인 아이템 등록 등)는 이후 과제로 남긴다.
import { findProjectByLocalPath } from "./config.mjs";
import { runBootSequence, formatBootSequenceReport } from "./boot-sequence.mjs";
import { startResponsePolling } from "./responses-poller.mjs";
import { injectAskUserQuestionAnswer, injectPermissionDecision } from "./tmux-inject.mjs";
import { syncUsageForProject } from "./usage-logs.mjs";
import { syncBacklogForProject } from "./backlog-sync.mjs";
import { syncQuotaForProject } from "./quota-sync.mjs";

const USAGE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// backlog.json은 로컬 디스크 읽기 + upsert 하나뿐이라 가볍다 — 개발 중에는 자주 바뀌므로
// usage_logs보다 훨씬 짧은 주기로 둔다(사용자 요청 2026-09-17: 웹에서 실제 상태를 보고 싶어함).
const BACKLOG_SYNC_INTERVAL_MS = 30 * 1000;
// /status 스크래핑은 사용자가 실제로 쓰고 있는 tmux pane에 개입하므로(quota-scraper.mjs의
// 안전 검사로 활성 상태면 건너뛰긴 하지만) usage_logs와 같은 5분 주기로 최대한 드물게 한다.
const QUOTA_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function dispatchResponse(sessionName, projectDir, normalized) {
  if (normalized.type === "ask_user_question") {
    injectAskUserQuestionAnswer(sessionName, normalized.optionIndex);
    return;
  }
  if (normalized.type === "permission") {
    injectPermissionDecision(sessionName, projectDir, normalized.decision);
    return;
  }
  throw new Error(`알 수 없는 응답 종류: ${normalized.type}`);
}

function startUsageSyncLoop(projectId, projectDir) {
  const tick = async () => {
    try {
      const n = await syncUsageForProject(projectId, projectDir);
      if (n > 0) console.error(`[daemon] usage_logs ${n}건 동기화`);
    } catch (err) {
      console.error(`[daemon] usage 동기화 실패: ${err.message}`);
    }
  };
  tick();
  const timer = setInterval(tick, USAGE_SYNC_INTERVAL_MS);
  return () => clearInterval(timer);
}

function startBacklogSyncLoop(projectId, projectDir) {
  const tick = async () => {
    try {
      const r = await syncBacklogForProject(projectId, projectDir);
      if (r.synced) console.error(`[daemon] backlog.json 동기화 완료`);
    } catch (err) {
      console.error(`[daemon] backlog 동기화 실패: ${err.message}`);
    }
  };
  tick();
  const timer = setInterval(tick, BACKLOG_SYNC_INTERVAL_MS);
  return () => clearInterval(timer);
}

function startQuotaSyncLoop(projectId, sessionName) {
  const tick = async () => {
    try {
      const r = await syncQuotaForProject(projectId, sessionName);
      if (r.synced) console.error(`[daemon] usage_quota(/status) 동기화 완료`);
      else console.error(`[daemon] usage_quota 동기화 건너뜀: ${r.reason}`);
    } catch (err) {
      console.error(`[daemon] usage_quota 동기화 실패: ${err.message}`);
    }
  };
  tick();
  const timer = setInterval(tick, QUOTA_SYNC_INTERVAL_MS);
  return () => clearInterval(timer);
}

/**
 * @param {{projectDir?: string}} opts
 */
export async function runDaemon(opts = {}) {
  const projectDir = opts.projectDir || process.cwd();
  const match = findProjectByLocalPath(projectDir);
  if (!match) {
    throw new Error(`이 디렉터리(${projectDir})는 등록되지 않았습니다 — 먼저 'claudebridge init'을 실행하세요.`);
  }
  const { projectId, info } = match;
  const sessionName = info.tmuxSession;

  const boot = await runBootSequence(projectDir, sessionName);
  console.log(formatBootSequenceReport(boot));
  if (!boot.passed) {
    throw new Error("안전 게이트를 통과하지 못해 데몬을 시작하지 않습니다(재시작마다 재검증 — 우회 불가).");
  }

  const stopUsageSync = startUsageSyncLoop(projectId, projectDir);
  const stopBacklogSync = startBacklogSyncLoop(projectId, projectDir);
  const stopQuotaSync = startQuotaSyncLoop(projectId, sessionName);
  const stopPolling = startResponsePolling(projectId, (response) => dispatchResponse(sessionName, projectDir, response));

  const shutdown = () => {
    console.log("\n[daemon] 종료 신호 수신 — 정리 중...");
    stopPolling();
    stopUsageSync();
    stopBacklogSync();
    stopQuotaSync();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`[daemon] 실행 중 — project_id=${projectId}, tmux session=${sessionName}`);
}
