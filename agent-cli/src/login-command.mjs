// `claudebridge login`(T-041) — 머신당 1회, 프로젝트 등록 API(POST /api/projects) 호출에
// 쓸 자격증명을 저장한다.
//
// 발급 방식(개발요청서.md 4장 미결 질문 최종 확정): web-app 트랙(T-040,
// lib/security/registration-token.ts)이 실제로 구현한 방식을 그대로 따른다 — CLI가 OAuth를
// 구현하는 대신, 웹 배포 시 환경변수로 심어둔 CLAUDEBRIDGE_REGISTRATION_TOKEN(공유 정적
// 비밀값)을 그대로 Authorization: Bearer 헤더에 실어 보낸다. 이 값은 사용자가 Vercel 프로젝트
// 설정에서 직접 확인해 CLI에 붙여넣는다(둘 다 같은 값을 알고 있어야 함 — 대칭키 방식).
// (애초에 구상했던 "구글 로그인에 위임하는 디바이스 코드 플로우"는 web-app 쪽에 대응하는
// 백엔드 엔드포인트가 없어 채택하지 않았다 — 두 트랙을 맞추면서 더 단순한 실제 계약으로 정리.)
import { createInterface } from "node:readline/promises";
import { saveConfig, loadConfig } from "./config.mjs";

async function promptForToken() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const token = await rl.question(
      "CLAUDEBRIDGE_REGISTRATION_TOKEN 값을 붙여넣으세요(웹 앱 Vercel 환경변수에서 확인): "
    );
    return token.trim();
  } finally {
    rl.close();
  }
}

/**
 * @param {{apiBaseUrl?: string, dashboardUrl?: string, token?: string}} opts
 */
export async function runLoginCommand(opts = {}) {
  const cfg = loadConfig();
  const apiBaseUrl = opts.apiBaseUrl || cfg.apiBaseUrl;
  const dashboardUrl = opts.dashboardUrl || cfg.dashboardUrl || apiBaseUrl;
  if (!apiBaseUrl) {
    throw new Error(
      "백엔드(Vercel) 배포 주소를 알 수 없습니다. --api-base-url <url> 로 지정하거나 " +
        "CLAUDEBRIDGE_API_BASE_URL 환경변수를 설정하세요."
    );
  }
  const token = (opts.token || process.env.CLAUDEBRIDGE_REGISTRATION_TOKEN || (await promptForToken())).trim();
  if (!token) throw new Error("토큰이 비어 있습니다 — 로그인을 취소합니다.");

  saveConfig({ ...cfg, apiBaseUrl, dashboardUrl, registrationToken: token });
  console.log("로그인 완료 — 등록 토큰이 ~/.claudebridge/config.json에 저장되었습니다(권한 600).");
}
