// CLI가 보증하는 "표준 위험 명령어 차단" 판정 로직.
//
// 이 파일은 이 저장소의 `.claude/hooks/block-dangerous-commands.mjs`(사용자가 이미 검증해
// 실제 운영 중인 훅)와 동일한 DANGEROUS_PATTERNS 판정 규칙을 그대로 이식한 것이다 — 로직을
// 새로 지어내지 않고 검증된 사본을 재사용한다(개발요청서.md I 항목: "CLI 자체가 보증하는
// 표준 훅만 자동 설치").
//
// 원본과의 차이는 배포 형태뿐이다: 원본은 프로젝트마다 파일로 복사해 넣는 훅 스크립트이지만,
// 여기서는 전역 CLI 패키지 안에 로직만 두고, 대상 프로젝트의 .claude/settings.json에는
// `claudebridge hook guard`를 호출하는 위임형 한 줄만 등록한다(H 항목: "로직 파일 복사 없음").
// 이렇게 하면 안전 게이트 훅 자체도 plug-and-play 원칙을 지키면서, 로직은 항상 CLI 버전 하나로
// 통일되어 프로젝트마다 사본이 드리프트할 위험이 없다.

function isRmRecursiveForce(command) {
  const rmMatch = /\brm\b([^;&|\n]*)/i.exec(command);
  if (!rmMatch) return false;
  const tokens = rmMatch[1].trim().split(/\s+/).filter(Boolean);
  const isShortOpt = (tok) => /^-[a-zA-Z]+$/.test(tok);
  const hasRecursive = tokens.some(
    (tok) => tok === "--recursive" || (isShortOpt(tok) && /r/i.test(tok.slice(1)))
  );
  const hasForce = tokens.some((tok) => tok === "--force" || (isShortOpt(tok) && /f/i.test(tok.slice(1))));
  return hasRecursive && hasForce;
}

function stripHeredocs(command) {
  const lines = command.split("\n");
  const kept = [];
  let activeDelim = null;
  for (const line of lines) {
    if (activeDelim !== null) {
      if (line.trim() === activeDelim) activeDelim = null;
      else continue;
      kept.push(line);
      continue;
    }
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line);
    if (m) activeDelim = m[2];
    kept.push(line);
  }
  return kept.join("\n");
}

function stripQuotedStrings(command) {
  return command.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'[^']*'/g, "''");
}

function scannableCommand(command) {
  return stripQuotedStrings(stripHeredocs(command));
}

export const DANGEROUS_PATTERNS = [
  {
    name: "rm -rf",
    pattern: { test: isRmRecursiveForce },
    reason: "재귀+강제 삭제는 되돌릴 수 없습니다. 삭제 대상을 좁히거나 -f 없이 먼저 확인하세요.",
  },
  {
    name: "git reset --hard",
    pattern: /\bgit\s+reset\s+--hard\b/,
    reason: "커밋되지 않은 변경사항을 되돌릴 수 없이 버립니다.",
  },
  {
    name: "git push --force",
    pattern: /\bgit\s+push\b(?![^\n]*--force-with-lease)[^\n]*(--force\b|(?<![\w-])-f(?![\w-]))/,
    reason: "원격 히스토리를 무조건 덮어씁니다. 필요하면 --force-with-lease를 사용하세요.",
  },
  {
    name: "git clean -f",
    pattern: /\bgit\s+clean\b[^\n]*-[a-zA-Z]*f/,
    reason: "추적되지 않는 파일을 되돌릴 수 없이 삭제합니다.",
  },
  {
    name: "chmod -R (root/broad)",
    pattern: /\bchmod\b[^\n]*-R[^\n]*\s(\/|~)(\s|$)/,
    reason: "루트/홈 디렉터리 전체 권한을 재귀적으로 바꾸는 것으로 보입니다.",
  },
  { name: "mkfs", pattern: /\bmkfs(\.\w+)?\b/, reason: "디스크를 포맷하는 명령입니다." },
  {
    name: "dd to device",
    pattern: /\bdd\b[^\n]*\bof=\/dev\//,
    reason: "디스크 장치에 직접 쓰는 명령입니다.",
  },
  {
    name: "direct device write",
    pattern: />\s*\/dev\/(disk|sd|hd|nvme|rdisk)/,
    reason: "디스크 장치 파일에 직접 리다이렉트합니다.",
  },
  {
    name: "fork bomb",
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "포크 폭탄 패턴입니다.",
  },
  {
    name: "system shutdown",
    pattern: /\b(shutdown|reboot|halt|poweroff)\b/,
    reason: "시스템을 종료/재시작하는 명령입니다.",
  },
  {
    name: "mass delete from root",
    pattern: /\bfind\s+\/\s+[^\n]*-delete\b/,
    reason: "루트에서부터 대량 삭제하는 명령입니다.",
  },
  {
    name: "pipe remote script to shell",
    pattern: /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/,
    reason: "원격 스크립트를 검증 없이 바로 실행합니다.",
  },
];

/**
 * @param {string} rawCommand PreToolUse(Bash) tool_input.command
 * @returns {{denied: boolean, name?: string, reason?: string}}
 */
export function evaluateBashCommand(rawCommand) {
  const command = scannableCommand(rawCommand ?? "");
  for (const { name, pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return { denied: true, name, reason };
  }
  return { denied: false };
}

/**
 * Claude Code PreToolUse 훅 stdin으로 들어오는 입력 전체를 받아 hookSpecificOutput 페이로드를
 * 만든다. Bash가 아닌 도구면 판단하지 않는다(allow와 동등 — 출력 없음을 의미).
 * @param {any} hookInput PreToolUse 훅에 전달되는 JSON(stdin 파싱 결과)
 * @returns {object|null} 차단 시 hookSpecificOutput 객체, 통과 시 null
 */
export function buildGuardDecision(hookInput) {
  if (hookInput?.tool_name !== "Bash") return null;
  const result = evaluateBashCommand(hookInput?.tool_input?.command ?? "");
  if (!result.denied) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `위험 명령으로 판단되어 차단되었습니다 [${result.name}]: ${result.reason}\n\n` +
        `이 판단이 틀렸다고 생각되면 더 좁은 범위의 명령으로 바꾸거나 사용자에게 직접 실행을 ` +
        `요청하세요(우회 시도 금지 — claudebridge 표준 가드 훅).`,
    },
  };
}

// Stage 1 자가진단(safety-gate-stage1.mjs)에서 쓰는 표준 테스트 명령 — 실제로 차단되는지
// 확인할 때 이 문자열을 넣어본다. 절대 실행되지 않는다(문자열로만 훅 stdin에 전달).
export const SELF_TEST_DANGEROUS_COMMAND = "rm -rf /";
