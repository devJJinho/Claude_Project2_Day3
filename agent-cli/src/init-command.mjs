// `claudebridge init`(T-042) — 프로젝트마다 실행하는 명령 1개로 등록부터 실행까지 자동화.
// 순서(개발요청서.md 3장, 절대 순서 고정): 0 안전게이트 1단계 -> 0-1 안전게이트 2단계(프리플라이트)
// -> 1 등록 API 호출 -> 2 settings.json 위임형 훅 삽입 -> 3 tmux 세션 생성+Claude Code 실행
// -> 4 완료 메시지.
//
// 가정하는 백엔드 API 계약(다른 트랙 구현 필요):
//   POST {apiBaseUrl}/api/projects  (Authorization: Bearer <personal access token>)
//     body: { name: string, localPath: string }
//     -> { project_id: string, dashboard_url: string }
//   이미 같은 localPath로 등록된 적이 있으면 기존 project_id를 그대로 반환(멱등)한다고 가정 —
//   init을 여러 번 실행해도 프로젝트가 중복 생성되지 않아야 하기 때문.
import path from "node:path";
import { checkStage1GuardActive } from "./safety-gate-stage1.mjs";
import { ensureStage1GuardOrInstall } from "./safety-gate-install.mjs";
import { checkStage2WebAccess } from "./safety-gate-stage2.mjs";
import { installHooks } from "./settings-writer.mjs";
import { buildHooksToInstall } from "./hook-delegate-template.mjs";
import { ensureSession, startClaudeCode, tmuxSessionName } from "./tmux-session.mjs";
import { loadConfig, registerProjectInConfig } from "./config.mjs";

async function registerProjectWithBackend(apiBaseUrl, token, name, localPath) {
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, localPath }),
  });
  if (!res.ok) throw new Error(`프로젝트 등록 API 실패: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * @param {{projectDir?: string, claudeCommand?: string}} opts
 */
export async function runInitCommand(opts = {}) {
  const projectDir = path.resolve(opts.projectDir || process.cwd());
  const cfg = loadConfig();
  if (!cfg.accessToken) throw new Error("로그인이 필요합니다 — 먼저 'claudebridge login'을 실행하세요.");
  if (!cfg.apiBaseUrl) throw new Error("백엔드 API 주소가 설정되지 않았습니다 — 'claudebridge login'을 다시 실행하세요.");

  // --- 0단계: 안전 게이트 1단계 ---
  const initialStage1 = checkStage1GuardActive(projectDir);
  const stage1 = initialStage1.passed ? initialStage1 : ensureStage1GuardOrInstall(projectDir);
  if (!stage1.passed) {
    throw new Error(`[안전 게이트 1단계 실패] ${stage1.reason}\ninit을 중단합니다 — 2단계로 진행하지 않습니다.`);
  }
  console.log(`[1단계 통과] ${stage1.reason}`);

  // --- 0-1단계: 안전 게이트 2단계(프리플라이트 — 아직 세션이 없으므로 세션명 없이 점검) ---
  const stage2 = await checkStage2WebAccess();
  if (!stage2.passed) {
    const detail = Object.entries(stage2.checks)
      .filter(([, c]) => !c.ok)
      .map(([k, c]) => `${k}: ${c.reason}`)
      .join("; ");
    throw new Error(`[안전 게이트 2단계 실패] ${detail}\ninit을 중단합니다.`);
  }
  console.log("[2단계 통과] tmux/Supabase 연결 확인 완료");

  // --- 1단계: 프로젝트 등록 ---
  const name = path.basename(projectDir);
  const { project_id: projectId, dashboard_url: dashboardUrl } = await registerProjectWithBackend(
    cfg.apiBaseUrl,
    cfg.accessToken,
    name,
    projectDir
  );
  console.log(`[등록 완료] project_id=${projectId}`);

  // --- 2단계: 위임형 훅 삽입(멱등) ---
  installHooks(projectDir, buildHooksToInstall());
  console.log("[훅 등록 완료] .claude/settings.json에 claudebridge 위임형 훅 3종 삽입");

  // --- 3단계: tmux 세션 생성 + Claude Code 실행 ---
  const sessionName = tmuxSessionName(projectId);
  const { created } = ensureSession(sessionName, projectDir);
  if (created) {
    startClaudeCode(sessionName, opts.claudeCommand);
    console.log(`[세션 생성] 새 tmux 세션(${sessionName})에서 Claude Code 실행`);
  } else {
    console.log(`[세션 재사용] 기존 tmux 세션(${sessionName})을 그대로 사용`);
  }

  registerProjectInConfig(projectId, { localPath: projectDir, tmuxSession: sessionName, registeredAt: new Date().toISOString() });

  // --- 4단계: 완료 메시지 ---
  console.log(`\n완료: 대시보드에서 확인하세요 -> ${dashboardUrl || cfg.dashboardUrl}`);
  return { projectId, dashboardUrl, sessionName };
}
