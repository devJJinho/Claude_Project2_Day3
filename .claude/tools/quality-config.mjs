// 코드 길이/lint/build 검사 공통 설정.
//
// 300줄을 출발점으로 채택한 근거: 리팩터 후 현재 소스 중 가장 큰 파일(backlog-mutations.mjs)이
// 203줄로 300에 30% 이상 여유가 있고, 나머지는 모두 120줄 이하다. 이 프로젝트는 아직 애플리케이션
// 본체(T-026 기술 스택 선정 대기)가 없어 backlog 관리용 CLI/훅 스크립트가 유일한 소스인데, 이런
// 단일 책임 스크립트들은 자연스럽게 100~250줄 사이에 머무르는 것으로 관측됐다. 300은 "아직 한 번도
// 자연스럽게 도달한 적 없는 상한"으로서, 실제로 초과하면 책임이 여러 개 섞였다는 신호로 보기에
// 적절한 여유폭이다. 애플리케이션 코드가 생기면(SOURCE_DIRS에 src/ 등을 추가할 때) 이 값과 근거를
// 다시 검토해야 한다.
export const LINE_LIMIT = 300;

// 소스로 취급할 디렉터리 + 확장자. backlog.json(데이터), PROGRESS.md(생성물),
// .backlog-backups/*.bak(생성물), node_modules/.next(의존성·빌드 산출물)는 의도적으로 제외한다.
// T-001(Next.js 스캐폴드)부터 app/(App Router 라우트)·components/·lib/이 웹 앱 소스,
// agent-cli/(로컬 에이전트·전역 CLI, T-013 스캐폴드)가 에이전트 소스다 — Next.js 라우팅
// 관례상 중첩 디렉터리가 필수라 check-code-length.mjs의 listSourceFiles()는 이 목록을
// 재귀적으로 순회한다(node_modules/.next 등은 내부에서 스킵).
export const SOURCE_DIRS = [
  ".claude/hooks",
  ".claude/tools",
  "dashboard",
  "app",
  "components",
  "lib",
  "agent-cli/bin",
  "agent-cli/src",
  "agent-cli/scripts",
];
export const SOURCE_EXTENSIONS = [".mjs", ".js", ".ts", ".tsx"];

// 재귀 스캔 시 절대 내려가지 않을 디렉터리 이름(의존성·빌드 산출물·버전관리).
export const SOURCE_SCAN_IGNORE_DIRS = ["node_modules", ".next", "dist", ".git"];

// 이 프로젝트의 lint 명령. 외부 도구가 없으면 NOT_CONFIGURED로 보고하고 통과로 처리하지 않는다.
// --deny-warnings 필수: oxlint는 기본적으로 warning만 있으면 exit 0(통과)로 처리한다 — 실제
// 실행으로 확인된 동작이라, 이 옵션 없이는 lint 위반이 조용히 통과된다. 특정 파일만 검사할 때도
// (quick-check) 이 플래그가 빠지면 안 되므로 flags와 defaultArgs를 분리해 둔다.
// middleware.ts/next.config.mjs는 루트 단일 파일이라 SOURCE_DIRS(디렉터리 목록)에 담기지
// 않으므로 oxlint 대상에 명시적으로 추가한다 — oxlint 자체는 파일 인자도 받는다.
export const LINT_COMMAND = {
  cmd: "node_modules/.bin/oxlint",
  flags: ["--deny-warnings"],
  defaultArgs: [...SOURCE_DIRS, "middleware.ts", "next.config.mjs"],
};

// 내부 검사 프로세스 하나당 타임아웃. 바깥 hook timeout(settings.json)보다 반드시 짧게 잡아서,
// 개별 검사가 멈추면 이 타임아웃이 먼저 끊고 TIMEOUT으로 보고한다 — 훅 전체가 강제 종료될 때까지
// 기다리지 않는다.
export const INNER_CHECK_TIMEOUT_MS = 20_000;

// TypeScript는 파일 단위가 아니라 프로젝트 전체를 한 번에 타입체크하는 tsc --noEmit 호출
// 하나로 검사한다(check-build.mjs) — 파일 수가 늘어도 여러 번 반복 실행하지 않으므로 별도의
// 더 넉넉한 타임아웃을 둔다.
export const TSC_TIMEOUT_MS = 60_000;
