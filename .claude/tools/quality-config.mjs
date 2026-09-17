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

// 소스로 취급할 디렉터리(재귀 없음, 얕은 스캔) + 확장자. backlog.json(데이터), PROGRESS.md(생성물),
// .backlog-backups/*.bak(생성물), node_modules(의존성)는 의도적으로 제외한다.
// 애플리케이션 코드(E2 기술 스택 확정 후 생길 src/ 하위 디렉터리)는 아직 없다 — 생기면 여기에
// 실제 .mjs/.js가 있는 하위 디렉터리를 각각 등록할 것(얕은 스캔이라 src 자체로는 부족함).
export const SOURCE_DIRS = [".claude/hooks", ".claude/tools", "dashboard"];
export const SOURCE_EXTENSIONS = [".mjs", ".js"];

// 이 프로젝트의 lint 명령. 외부 도구가 없으면 NOT_CONFIGURED로 보고하고 통과로 처리하지 않는다.
// --deny-warnings 필수: oxlint는 기본적으로 warning만 있으면 exit 0(통과)로 처리한다 — 실제
// 실행으로 확인된 동작이라, 이 옵션 없이는 lint 위반이 조용히 통과된다. 특정 파일만 검사할 때도
// (quick-check) 이 플래그가 빠지면 안 되므로 flags와 defaultArgs를 분리해 둔다.
export const LINT_COMMAND = {
  cmd: "node_modules/.bin/oxlint",
  flags: ["--deny-warnings"],
  defaultArgs: [...SOURCE_DIRS],
};

// 내부 검사 프로세스 하나당 타임아웃. 바깥 hook timeout(settings.json)보다 반드시 짧게 잡아서,
// 개별 검사가 멈추면 이 타임아웃이 먼저 끊고 TIMEOUT으로 보고한다 — 훅 전체가 강제 종료될 때까지
// 기다리지 않는다.
export const INNER_CHECK_TIMEOUT_MS = 20_000;
