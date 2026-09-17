#!/usr/bin/env node
// push_subscriptions을 흉내 낸 로컬 PostgREST 서버 + 실제 push 엔드포인트 역할을 하는 로컬
// HTTPS 서버를 띄워, push-sender.mjs(T-033)가 VAPID 서명된 웹 푸시를 실제로 발송하는지
// 확인한다. web-push 라이브러리는 항상 node:https로 요청하므로(소스 확인 —
// node_modules/web-push/src/web-push-lib.js) 목 엔드포인트도 TLS로 띄워야 한다. 로컬에
// openssl이 있으면 임시 자기서명 인증서를 만들어 사용하고, 없으면 이 통합 테스트만 건너뛴다
// (guard-hook-logic 등 다른 스모크 테스트에는 영향 없음).
// 실행: node scripts/integration-test-mock-push.mjs
import https from "node:https";
import http from "node:http";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import webpush from "web-push";

function generateSelfSignedCert() {
  const dir = mkdtempSync(path.join(tmpdir(), "claudebridge-push-test-"));
  const keyPath = path.join(dir, "key.pem");
  const certPath = path.join(dir, "cert.pem");
  const r = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-keyout", keyPath, "-out", certPath,
    "-days", "1", "-nodes", "-subj", "/CN=localhost",
  ]);
  if (r.status !== 0) return null;
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

const tls = generateSelfSignedCert();
if (!tls) {
  console.log("건너뜀 - openssl을 찾을 수 없어 HTTPS 목 서버를 만들 수 없습니다(web-push는 https 고정).");
  process.exit(0);
}
// 자기서명 인증서를 신뢰하도록 이 프로세스에서만 검증을 끈다(로컬 테스트 전용 — 운영 코드
// 경로에는 영향 없음. push-sender.mjs 자체는 이 환경변수를 설정하지 않는다).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;

let receivedPushBody = null;
const pushEndpointServer = https.createServer(tls, (req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    receivedPushBody = body;
    res.writeHead(201);
    res.end();
  });
});
await new Promise((r) => pushEndpointServer.listen(0, r));
const pushPort = pushEndpointServer.address().port;

// 수신자 쪽 P-256 키(브라우저 구독을 흉내) — 형식만 유효하면 web-push 암호화 단계를 통과한다.
const recipientKeys = webpush.generateVAPIDKeys();
const subscriptions = [
  {
    endpoint: `https://127.0.0.1:${pushPort}/push-endpoint-1`,
    p256dh: recipientKeys.publicKey,
    auth: Buffer.from("0123456789abcdef").toString("base64url").slice(0, 22),
  },
];

const restServer = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/rest/v1/push_subscriptions") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(subscriptions));
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => restServer.listen(0, r));
process.env.SUPABASE_URL = `http://127.0.0.1:${restServer.address().port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

const { sendPushForBlockedEvent } = await import("../src/push-sender.mjs");
const result = await sendPushForBlockedEvent(
  "ask_user_question",
  { question: "배포할까요?", options: ["예", "아니오"] },
  "https://dashboard.example.com"
);

assert.equal(result.sent, 1);
assert.equal(result.failed, 0);
assert.ok(receivedPushBody, "실제 push 엔드포인트가 요청을 받아야 함");
console.log("ok - sendPushForBlockedEvent(T-033): push_subscriptions 조회 → web-push로 실제 HTTPS 발송 성공(sent=1)");

pushEndpointServer.close();
restServer.close();
console.log("\n전체 통과 — VAPID 서명 웹 푸시가 실제 HTTPS 요청으로 목적지 엔드포인트까지 도달함을 확인.");
