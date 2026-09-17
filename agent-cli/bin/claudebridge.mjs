#!/usr/bin/env node
// claudebridge CLI 진입점(T-013 스캐폴드 + 전체 서브커맨드 라우팅).
// 전역 설치(`npm i -g claudebridge`) 후 어느 프로젝트 디렉터리에서든 이 하나의 실행 파일로
// login/init/run과, settings.json이 위임하는 hook 서브커맨드까지 전부 처리한다(H 항목:
// 프로젝트마다 별도 node_modules/파일 복사 없음).
// 서브커맨드별로 동적 import한다(정적 import 금지) — 가장 안전에 민감한 `hook guard`가
// web-push/@supabase/supabase-js 같은 무관한 의존성 로딩 실패 때문에 깨지면 안 되기 때문이다.
// (실제로 정적 import로 짰다가 web-push 미설치 상태에서 guard 훅 자체가 죽는 문제를 발견해
// 이 구조로 고쳤다 — 안전 게이트 훅은 항상 최소 의존성으로 동작해야 한다.)
import { readStdinJson } from "../src/stdin-json.mjs";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      flags[key] = value;
    }
  }
  return flags;
}

async function runHookGuard() {
  const { buildGuardDecision } = await import("../src/guard-hook-logic.mjs");
  const input = await readStdinJson();
  const decision = buildGuardDecision(input);
  if (decision) console.log(JSON.stringify(decision));
  process.exit(0);
}

async function dispatch(argv) {
  const [command, sub, ...rest] = argv;
  const flags = parseFlags(rest);

  if (command === "login") {
    const { runLoginCommand } = await import("../src/login-command.mjs");
    await runLoginCommand({ apiBaseUrl: flags["api-base-url"] });
    return;
  }
  if (command === "init") {
    const { runInitCommand } = await import("../src/init-command.mjs");
    await runInitCommand({ projectDir: flags["project-dir"], claudeCommand: flags["claude-command"] });
    return;
  }
  if (command === "run") {
    const { runDaemon } = await import("../src/daemon.mjs");
    await runDaemon({ projectDir: flags["project-dir"] });
    return;
  }
  if (command === "hook") {
    if (sub === "guard") return runHookGuard();
    if (sub === "ask-question") {
      const { runAskQuestionHookFromStdin } = await import("../src/ask-question-hook.mjs");
      return runAskQuestionHookFromStdin(readStdinJson);
    }
    if (sub === "permission") {
      const { runPermissionHookFromStdin } = await import("../src/permission-hook.mjs");
      return runPermissionHookFromStdin(readStdinJson);
    }
    throw new Error(`알 수 없는 hook 서브커맨드: ${sub} (guard|ask-question|permission)`);
  }
  console.log(
    "사용법: claudebridge <login|init|run|hook <guard|ask-question|permission>>\n" +
      "  login  --api-base-url <url>          머신당 1회 로그인\n" +
      "  init   [--project-dir <path>]        현재 프로젝트에 ClaudeBridge 연결\n" +
      "  run    [--project-dir <path>]        로컬 상주 에이전트 실행(폴링+주입)\n" +
      "  hook <name>                          settings.json이 내부적으로 호출(직접 실행 X)"
  );
}

dispatch(process.argv.slice(2)).catch((err) => {
  console.error(`claudebridge 오류: ${err.message}`);
  process.exit(1);
});
