#!/usr/bin/env node
// 실제 Supabase 프로젝트가 아직 없어(T-003 needs_info) 라이브 DB로 검증할 수 없는 부분을,
// 최소 PostgREST 흉내 로컬 HTTP 서버로 검증하는 통합 테스트. 목적: "AskUserQuestion 1건을
// 웹에서 응답 → tmux 주입까지"의 앞부분(hook 기록 → 웹 응답 시뮬레이션 → 폴링 → optionIndex
// 계산)이 실제 HTTP/JSON 왕복(가짜 서버지만 @supabase/supabase-js가 실제로 통신함)으로
// 끝까지 이어지는지 확인한다. 실행: node scripts/integration-test-mock-backend.mjs
//
// 실제 Supabase가 생기면(T-003 해결 후) 이 테스트는 계속 남겨두되, 진짜 통합 테스트(실제
// 프로젝트에 대해 도는)를 별도로 추가하는 것을 권장한다 — 이 파일은 "계약이 맞는지"만 본다.
import http from "node:http";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const blockedEvents = new Map();
const responses = [];

function parseQuery(url) {
  return Object.fromEntries(new URL(url, "http://x").searchParams.entries());
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const table = url.pathname.replace("/rest/v1/", "");
    const q = parseQuery(req.url);

    if (req.method === "POST" && table === "blocked_events") {
      const row = { id: randomUUID(), ...JSON.parse(body), created_at: new Date().toISOString(), resolved_at: null };
      blockedEvents.set(row.id, row);
      const wantsSingleObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify(wantsSingleObject ? row : [row]));
    }
    if (req.method === "GET" && table === "blocked_events") {
      const id = (q.id || "").replace("eq.", "");
      const row = blockedEvents.get(id);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(row ? [row] : []));
    }
    if (req.method === "POST" && table === "responses") {
      const row = JSON.parse(body);
      responses.push(row);
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify([row]));
    }
    if (req.method === "GET" && table === "responses") {
      const filtered = responses.filter((r) => r.project_id === (q.project_id || "").replace("eq.", ""));
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(filtered));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found_in_mock" }));
  });
});

await new Promise((resolve) => server.listen(0, resolve));
process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;

const { recordBlockedEvent } = await import("../src/blocked-events.mjs");
const { fetchNewResponses } = await import("../src/responses-poller.mjs");
const { resolveInjectionInput } = await import("../src/response-resolver.mjs");
const { getSupabaseClient } = await import("../src/supabase-client.mjs");

const projectId = "clb_test0000000000000001";
const { id: eventId } = await recordBlockedEvent({
  projectId,
  type: "ask_user_question",
  payload: { question: "배포할까요?", options: ["예", "아니오", "나중에"] },
});
assert.ok(eventId, "blocked_events insert가 id를 반환해야 함");
console.log("ok - recordBlockedEvent(T-017): blocked_events insert 성공, id=", eventId);

const supabase = getSupabaseClient();
await supabase.from("responses").insert({
  id: randomUUID(),
  event_id: eventId,
  project_id: projectId,
  choice: "아니오",
  responded_by: "jhjeong710@gmail.com",
  created_at: new Date().toISOString(),
});
console.log("ok - (웹 응답 시뮬레이션) responses에 choice='아니오' 기록");

const newResponses = await fetchNewResponses(projectId, new Date(0).toISOString());
assert.equal(newResponses.length, 1);
assert.equal(newResponses[0].choice, "아니오");
console.log("ok - fetchNewResponses(T-018): 새 응답 1건 조회 성공");

const normalized = resolveInjectionInput(newResponses[0], blockedEvents.get(eventId));
assert.deepEqual(normalized, { type: "ask_user_question", optionIndex: 2 });
console.log("ok - resolveInjectionInput(T-022): choice='아니오' → optionIndex=2");

server.close();
console.log(
  "\n전체 통과 — AskUserQuestion 경로(훅 기록 → 웹 응답 → 폴링 → optionIndex 계산)가 실제 " +
    "HTTP/JSON 왕복으로 끝까지 연결됨을 확인. tmux 주입 자체는 이 머신에 tmux가 없어 별도" +
    "단위 테스트(smoke-test.mjs, key-mapping/tmux-inject 사전조건)로 검증했다."
);
