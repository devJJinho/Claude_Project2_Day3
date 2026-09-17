#!/usr/bin/env node
// backlog.json을 읽기 전용으로 참조해 PROGRESS.md를 재생성한다.
// backlog.json 자체는 절대 쓰지 않는다 — 상태 변경은 사람/스킬이 직접 편집한다.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const backlogPath = path.join(projectRoot, "backlog.json");
const progressPath = path.join(projectRoot, "PROGRESS.md");

function loadBacklog() {
  let raw;
  try {
    raw = readFileSync(backlogPath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { parseError: true };
  }
}

function statusLabel(status) {
  return { todo: "할 일", doing: "진행 중", done: "완료", blocked: "미결/보류" }[status] ?? status;
}

function render(backlog) {
  const now = new Date().toISOString();

  if (!backlog) {
    return `# 진행 상황\n\n_backlog.json을 찾을 수 없습니다. (생성: ${now})_\n`;
  }
  if (backlog.parseError) {
    return `# 진행 상황\n\n_backlog.json 파싱에 실패했습니다. 파일을 확인하세요. (생성: ${now})_\n`;
  }

  const tasks = Array.isArray(backlog.tasks) ? backlog.tasks : [];
  const counts = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;

  const byCategory = new Map();
  for (const t of tasks) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  const lines = [];
  lines.push(`# 진행 상황`);
  lines.push("");
  lines.push(`_이 파일은 \`backlog.json\`으로부터 자동 생성됩니다. 직접 편집하지 마세요. (생성: ${now})_`);
  lines.push("");
  lines.push(`프로젝트: **${backlog.project ?? "(이름 없음)"}**`);
  lines.push("");
  lines.push(`## 요약`);
  lines.push("");
  lines.push(`전체 ${tasks.length}개 작업 — ` + Object.entries(counts).map(([s, c]) => `${statusLabel(s)} ${c}`).join(", "));
  lines.push("");
  lines.push(`## 카테고리별 상세`);
  lines.push("");

  for (const [category, list] of byCategory) {
    lines.push(`### ${category}`);
    lines.push("");
    lines.push(`| ID | 상태 | 제목 |`);
    lines.push(`|---|---|---|`);
    for (const t of list) {
      lines.push(`| ${t.id} | ${statusLabel(t.status)} | ${t.title} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const backlog = loadBacklog();
writeFileSync(progressPath, render(backlog), "utf8");
