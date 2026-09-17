#!/usr/bin/env node
// PreToolUse(Bash) 훅: 되돌릴 수 없거나 시스템 전체에 영향을 주는 명령을 하드 차단한다.
// require-backlog-cli.mjs와 동일하게 휴리스틱 정규식 기반이다 — 완전한 보안 경계가 아니라
// "흔히 쓰는 형태"를 막는 것이 목적이다(예: base64 인코딩, alias 우회 등 임의 우회는 못 막음).
// 우회 방법을 찾기보다 이 목록 자체를 확장/조정하는 방향으로 대응한다.
//
// git push --force-with-lease는 원격의 최신 상태를 확인하고 안전하게 덮어쓰는 방식이라
// 의도적으로 허용 목록에 둔다(막는 대상은 무조건 덮어쓰는 --force/-f뿐).

import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function denyPreToolUse(name, reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `위험 명령으로 판단되어 차단되었습니다 [${name}]: ${reason}\n\n` +
          `이 판단이 틀렸다고 생각되면(예: 의도된 정상 작업), 더 좁은 범위의 명령으로 바꾸거나 ` +
          `사용자에게 직접 실행을 요청하세요(우회 시도 금지 — 이 훅은 .claude/hooks/block-dangerous-commands.mjs).`,
      },
    })
  );
  process.exit(0);
}

function allow() {
  process.exit(0);
}

// 히어독 본문(예: git commit -m "$(cat <<'EOF' ... EOF)")은 실행되는 명령이 아니라 텍스트
// 데이터다 — 커밋 메시지에 "rm -rf" 같은 단어가 그냥 언급만 돼도 오탐되는 걸 막기 위해,
// 여는 줄(<<[-]DELIM)부터 DELIM만 있는 줄 전까지는 검사 대상에서 제외한다.
function stripHeredocs(command) {
  const lines = command.split("\n");
  const kept = [];
  let activeDelim = null;
  for (const line of lines) {
    if (activeDelim !== null) {
      if (line.trim() === activeDelim) activeDelim = null;
      else continue; // 히어독 본문 — 검사하지 않음
      kept.push(line);
      continue;
    }
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line);
    if (m) activeDelim = m[2];
    kept.push(line);
  }
  return kept.join("\n");
}

// 따옴표로 감싼 문자열(예: -m "설명 중 rm -rf 언급")도 같은 이유로 내용을 지운다.
// bash 문법을 완전히 파싱하지 않는 휴리스틱이라 이스케이프까지 완벽히 다루지는 않는다.
function stripQuotedStrings(command) {
  return command.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'[^']*'/g, "''");
}

function scannableCommand(command) {
  return stripQuotedStrings(stripHeredocs(command));
}

// rm 호출 하나를 검사: 같은 명령 안에(;/&&/|로 구분된 다음 명령으로 넘어가기 전까지) 재귀 플래그와
// 강제 플래그가 함께 있으면 위험한 것으로 본다. 결합형(-rf/-fr/-Rf)과 분리형(-r -f), 롱옵션
// (--recursive/--force) 모두 잡는다. 파일명에 우연히 r/f가 들어간 경우를 피하려고 '-'로 시작하는
// 토큰만 플래그로 취급한다.
function isRmRecursiveForce(command) {
  const rmMatch = /\brm\b([^;&|\n]*)/i.exec(command);
  if (!rmMatch) return false;
  const tokens = rmMatch[1].trim().split(/\s+/).filter(Boolean);
  // 짧은 옵션(-rf, -r, -f 등: 대시 하나 + 글자만)과 긴 옵션(--recursive/--force 정확히 일치)만
  // 플래그로 본다 — "--preserve-root" 같은 안전 플래그가 'r'을 포함한다고 오탐하지 않기 위함.
  const isShortOpt = (tok) => /^-[a-zA-Z]+$/.test(tok);
  const hasRecursive = tokens.some(
    (tok) => tok === "--recursive" || (isShortOpt(tok) && /r/i.test(tok.slice(1)))
  );
  const hasForce = tokens.some((tok) => tok === "--force" || (isShortOpt(tok) && /f/i.test(tok.slice(1))));
  return hasRecursive && hasForce;
}

// { name, pattern, reason } — pattern은 함수여도 되고 정규식이어도 된다(test(command) 호출).
const DANGEROUS_PATTERNS = [
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
  {
    name: "mkfs",
    pattern: /\bmkfs(\.\w+)?\b/,
    reason: "디스크를 포맷하는 명령입니다.",
  },
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

let input;
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  allow();
}

if (input?.tool_name !== "Bash") {
  allow();
}

const command = scannableCommand(input?.tool_input?.command ?? "");

for (const { name, pattern, reason } of DANGEROUS_PATTERNS) {
  if (pattern.test(command)) {
    denyPreToolUse(name, reason);
  }
}

allow();
