// 막힌 이벤트 발생 시 웹 푸시 발송(T-033). 다른 트랙(T-032, web-app worktree)이 Service
// Worker + 구독 등록을 만들어 push_subscriptions 테이블에 저장해두면, 여기서 그 구독들을
// 읽어와 web-push 라이브러리로 VAPID 서명된 푸시를 직접 발송한다(별도 서버 불필요 — 로컬
// 에이전트 프로세스 안에서 바로 web.push.sendNotification 호출).
import webpush from "web-push";
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { getVapidCredentials } from "./config.mjs";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getVapidCredentials();
  if (!publicKey || !privateKey) {
    throw new Error(
      "CLAUDEBRIDGE_VAPID_PUBLIC_KEY / CLAUDEBRIDGE_VAPID_PRIVATE_KEY 환경변수가 설정되지 않았습니다."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

async function fetchSubscriptions() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLES.PUSH_SUBSCRIPTIONS).select("endpoint, keys");
  if (error) throw new Error(`push_subscriptions 조회 실패: ${error.message}`);
  return data ?? [];
}

/**
 * @param {{title:string, body:string, url?:string}} notification
 * @returns {Promise<{sent:number, failed:number}>}
 */
export async function sendPushToAllSubscriptions(notification) {
  ensureVapidConfigured();
  const subscriptions = await fetchSubscriptions();
  const payload = JSON.stringify(notification);
  let sent = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[push-sender] 발송 실패(endpoint=${sub.endpoint}): ${err.message}`);
    }
  }
  return { sent, failed };
}

/**
 * blocked_events 하나에 대한 알림 문구를 만들어 즉시 발송한다(F 항목: "즉시 발송").
 * ask-question-hook.mjs / permission-hook.mjs가 blocked_events를 기록한 직후 호출한다.
 * @param {"ask_user_question"|"permission"} kind
 * @param {object} payload schema-contract.mjs의 payload
 * @param {string} dashboardUrl
 */
export async function sendPushForBlockedEvent(kind, payload, dashboardUrl) {
  const title = kind === "ask_user_question" ? "Claude Code가 선택을 기다립니다" : "Claude Code가 승인을 기다립니다";
  const body =
    kind === "ask_user_question" ? payload.question ?? "선택지를 확인해주세요" : payload.message ?? "권한 승인이 필요합니다";
  return sendPushToAllSubscriptions({ title, body, url: dashboardUrl });
}
