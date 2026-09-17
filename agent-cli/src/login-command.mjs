// `claudebridge login`(T-041) — 머신당 1회, 개인 액세스 토큰 발급.
//
// 발급 방식 결정(개발요청서.md 4장 미결 질문 해소): 단순 랜덤 토큰을 CLI가 스스로 생성해
// 서버에 등록하는 방식 대신, "디바이스 코드 플로우"(gh auth login과 동일한 패턴)를 택했다.
// 이유: (1) 이 프로젝트의 인증은 이미 구글 OAuth + 이메일 화이트리스트(C 항목)로 웹 쪽에
// 구현되므로, CLI가 별도로 OAuth 클라이언트를 구현할 필요 없이 "이미 로그인된 브라우저"에
// 위임할 수 있다. (2) 화이트리스트 검증(이 계정이 jhjeong710@gmail.com인지)을 서버가 한
// 곳에서만 하게 되어 CLI 쪽에 자격 검증 로직을 중복시키지 않는다.
//
// 가정하는 백엔드 API 계약(다른 트랙 구현 필요 — 정확한 스키마는 합의 전까지 가정):
//   POST {apiBaseUrl}/api/cli/device-code
//     -> { device_code: string, verify_url: string, expires_in: number(sec), interval: number(sec) }
//   GET  {apiBaseUrl}/api/cli/device-code/:device_code
//     -> { status: "pending" } | { status: "approved", token: string } | { status: "expired" | "denied" }
//   verify_url은 대시보드의 로그인 페이지로, 사용자가 구글 로그인 후 코드를 확인/승인하면
//   서버가 해당 device_code를 approved로 바꾸고 개인 액세스 토큰을 발급한다고 가정한다.
import { spawn } from "node:child_process";
import { saveConfig, loadConfig } from "./config.mjs";

function openBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // 브라우저 자동 실행 실패는 치명적이지 않음 — URL을 출력해뒀으니 사용자가 직접 열면 된다.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDeviceCode(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/cli/device-code`, { method: "POST" });
  if (!res.ok) throw new Error(`device-code 발급 실패: HTTP ${res.status}`);
  return res.json();
}

async function pollDeviceCode(apiBaseUrl, deviceCode, intervalSec, expiresInSec) {
  const deadline = Date.now() + expiresInSec * 1000;
  while (Date.now() < deadline) {
    await sleep(intervalSec * 1000);
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/cli/device-code/${deviceCode}`);
    if (!res.ok) throw new Error(`device-code 조회 실패: HTTP ${res.status}`);
    const body = await res.json();
    if (body.status === "approved") return body.token;
    if (body.status === "expired" || body.status === "denied") {
      throw new Error(`로그인이 ${body.status === "expired" ? "만료" : "거부"}되었습니다.`);
    }
    // "pending"이면 계속 대기
  }
  throw new Error("로그인 대기 시간이 초과되었습니다. 다시 시도해주세요.");
}

/**
 * @param {{apiBaseUrl?: string}} opts
 */
export async function runLoginCommand(opts = {}) {
  const apiBaseUrl = opts.apiBaseUrl || loadConfig().apiBaseUrl;
  if (!apiBaseUrl) {
    throw new Error(
      "백엔드 API 주소를 알 수 없습니다. --api-base-url <url> 로 지정하거나 " +
        "CLAUDEBRIDGE_API_BASE_URL 환경변수를 설정하세요."
    );
  }
  const { device_code: deviceCode, verify_url: verifyUrl, expires_in: expiresIn, interval } =
    await requestDeviceCode(apiBaseUrl);

  console.log(`브라우저에서 다음 주소를 열어 로그인해주세요:\n  ${verifyUrl}`);
  openBrowser(verifyUrl);
  console.log("로그인을 완료할 때까지 기다리는 중...");

  const token = await pollDeviceCode(apiBaseUrl, deviceCode, interval, expiresIn);
  saveConfig({ ...loadConfig(), apiBaseUrl, accessToken: token });
  console.log("로그인 완료 — 개인 액세스 토큰이 ~/.claudebridge/config.json에 저장되었습니다.");
}
