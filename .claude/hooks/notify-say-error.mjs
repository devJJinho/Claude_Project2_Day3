#!/usr/bin/env node
// PostToolUseFailure 훅(모든 도구 대상): 도구 실행이 실패로 끝났을 때 macOS `say`로 음성
// 안내한다. 이 이벤트 자체가 "에러 상황 발생"을 뜻하므로 실패 내용을 따로 파싱하지 않고
// 항상 안내한다 — 어떤 도구든 실패는 사람이 알아채야 하는 상황이기 때문이다.

import { speak, readStdinJson } from "./say-voice.mjs";

const input = readStdinJson();
const toolName = typeof input?.tool_name === "string" ? input.tool_name : "";

speak(toolName ? `에러가 발생했습니다. ${toolName} 도구 실행 중 문제가 생겼습니다.` : "에러가 발생했습니다. 확인이 필요합니다.");
process.exit(0);
