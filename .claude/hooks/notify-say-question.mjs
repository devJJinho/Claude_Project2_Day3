#!/usr/bin/env node
// PreToolUse(AskUserQuestion) 훅: Claude가 사용자에게 선택을 요청하는 시점에 macOS `say`로
// 음성 안내한다. matcher가 이미 AskUserQuestion으로 좁혀져 있으므로 입력 내용을 더 따질
// 필요 없이 항상 안내한다. 허용/차단 판단이 아니라 안내만 하는 훅이라 항상 통과시킨다.

import { speak } from "./say-voice.mjs";

speak("확인이 필요합니다. 선택해 주세요.");
process.exit(0);
