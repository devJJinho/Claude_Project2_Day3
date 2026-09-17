// 머신 전역 설정(~/.claudebridge/config.json) 읽기/쓰기.
//
// 저장하는 것: 개인 액세스 토큰(claudebridge login으로 발급), 백엔드 API base URL,
// 등록된 프로젝트 목록(project_id ↔ 로컬 경로 ↔ tmux 세션명 매핑).
//
// 저장하지 않는 것: Supabase 서비스 롤 키. 개발요청서.md I 항목("서비스 롤 키는 로컬
// 환경변수에만 보관")에 따라 서비스 롤 키는 항상 환경변수(CLAUDEBRIDGE_SUPABASE_URL /
// CLAUDEBRIDGE_SUPABASE_SERVICE_ROLE_KEY)로만 읽는다 — 파일에 남기지 않는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(homedir(), ".claudebridge");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  apiBaseUrl: process.env.CLAUDEBRIDGE_API_BASE_URL || "",
  accessToken: null,
  dashboardUrl: process.env.CLAUDEBRIDGE_DASHBOARD_URL || "",
  projects: {}, // project_id -> { localPath, tmuxSession, registeredAt }
};

export function getConfigPath() {
  return CONFIG_PATH;
}

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    throw new Error(`설정 파일을 읽을 수 없습니다(${CONFIG_PATH}): ${err.message}`);
  }
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const toWrite = { ...DEFAULT_CONFIG, ...config };
  writeFileSync(CONFIG_PATH, JSON.stringify(toWrite, null, 2) + "\n", "utf8");
  // 개인 액세스 토큰이 담긴 파일이므로 소유자만 읽기/쓰기 가능하도록 제한한다.
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Windows 등 chmod 미지원 환경에서는 조용히 무시(플랫폼 한계 — 강제 불가).
  }
  return toWrite;
}

export function isLoggedIn() {
  const cfg = loadConfig();
  return Boolean(cfg.accessToken);
}

export function registerProjectInConfig(projectId, info) {
  const cfg = loadConfig();
  cfg.projects[projectId] = { ...cfg.projects[projectId], ...info };
  return saveConfig(cfg);
}

/**
 * 훅은 project_id를 모른 채(대상 프로젝트 디렉터리 안에서) 실행되므로, 로컬 경로로
 * 역조회한다. claudebridge init이 등록할 때 localPath를 절대경로로 저장해두는 것을 전제한다.
 * @param {string} localPath 훅 실행 시점의 프로젝트 루트(절대경로)
 * @returns {{projectId: string, info: object}|null}
 */
export function findProjectByLocalPath(localPath) {
  const cfg = loadConfig();
  for (const [projectId, info] of Object.entries(cfg.projects)) {
    if (info.localPath === localPath) return { projectId, info };
  }
  return null;
}

// 서비스 롤 키/URL은 항상 환경변수에서만 읽는다. 없으면 null을 반환하고, 호출부가
// "설정 안 됨"으로 취급해 명확한 에러를 낸다(조용히 폴백하지 않음).
export function getSupabaseServiceCredentials() {
  const url = process.env.CLAUDEBRIDGE_SUPABASE_URL || null;
  const serviceRoleKey = process.env.CLAUDEBRIDGE_SUPABASE_SERVICE_ROLE_KEY || null;
  return { url, serviceRoleKey };
}

export function getVapidCredentials() {
  return {
    publicKey: process.env.CLAUDEBRIDGE_VAPID_PUBLIC_KEY || null,
    privateKey: process.env.CLAUDEBRIDGE_VAPID_PRIVATE_KEY || null,
    subject: process.env.CLAUDEBRIDGE_VAPID_SUBJECT || "mailto:jhjeong710@gmail.com",
  };
}
