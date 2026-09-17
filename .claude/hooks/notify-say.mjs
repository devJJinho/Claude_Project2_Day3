#!/usr/bin/env node
// PostToolUse(Bash) 훅: backlog-cli.mjs의 set-status/add 호출이 실제로 성공해서
// 상태가 done(작업 완료) 또는 needs_info(사람 결정 필요)로 바뀌었을 때만 macOS `say`로
// 음성 알림한다. 매 턴마다 울리면 노이즈라, 이 프로젝트의 진행 상태 단일 진실 공급원인
// backlog.json의 실제 상태 전이에만 정확히 건다.
//
// 이 훅 자체는 backlog.json을 읽거나 쓰지 않는다 — Bash 명령/출력 텍스트만 본다.
// 일반적인 "선택 필요"/"에러 발생" 음성 안내는 각각 notify-say-question.mjs /
// notify-say-error.mjs가 담당한다(책임 분리 — code-structure.md).

import { speak, readStdinJson } from "./say-voice.mjs";

function extractResponseText(toolResponse) {
  if (toolResponse == null) return "";
  if (typeof toolResponse === "string") return toolResponse;
  try {
    return JSON.stringify(toolResponse);
  } catch {
    return "";
  }
}

const input = readStdinJson();

const command = input?.tool_input?.command ?? "";
const SET_STATUS_RE = /backlog-cli\.mjs\b[^\n]*\bset-status\s+(\S+)\s+(\S+)/;
const ADD_NEEDS_INFO_RE = /backlog-cli\.mjs\b[^\n]*\badd\b[^\n]*--status\s+needs_info/;

const responseText = extractResponseText(input?.tool_response);

const setStatusMatch = SET_STATUS_RE.exec(command);
if (setStatusMatch && responseText.includes("상태 변경 완료:")) {
  const [, id, status] = setStatusMatch;
  if (status === "done") {
    speak(`작업 ${id.replace(/-/g, " ")} 완료되었습니다.`);
  } else if (status === "needs_info") {
    speak(`확인이 필요합니다. 작업 ${id.replace(/-/g, " ")} 진행을 위해 결정이 필요합니다.`);
  }
}

if (ADD_NEEDS_INFO_RE.test(command) && responseText.includes("추가 완료:")) {
  speak("새 작업이 확인이 필요한 상태로 추가되었습니다.");
}

process.exit(0);
