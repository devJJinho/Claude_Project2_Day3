#!/usr/bin/env node
// T-035: 화이트리스트 외 계정 접근 차단 테스트.
// lib/auth/whitelist.ts(실제 인증 미들웨어가 쓰는 바로 그 모듈)를 직접 불러 검증한다.
// Node의 타입 스트리핑(--experimental-strip-types)으로 TS 파일을 컴파일 단계 없이 실행한다.
import { isWhitelistedEmail } from "../lib/auth/whitelist.ts";

const cases = [
  ["jhjeong710@gmail.com", true],
  ["attacker@evil.com", false],
  ["JHJEONG710@GMAIL.COM", true],
  [null, false],
  ["", false],
];

let pass = 0;
for (const [email, expected] of cases) {
  const actual = isWhitelistedEmail(email);
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}: isWhitelistedEmail(${JSON.stringify(email)}) = ${actual} (expected ${expected})`);
  if (ok) pass++;
}

console.log(`${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
