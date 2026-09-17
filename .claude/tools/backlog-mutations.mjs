// backlog.json 쓰기 명령(add/set-status): 검증 -> 백업 -> 버전 재확인 -> 원자적 저장 순으로 처리한다.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import path from "node:path";
import { VALID_STATUS, KNOWN_CATEGORIES, ID_PATTERN, hashOf, validateBacklog, findDependencyCycle } from "./backlog-schema.mjs";
import { findTask } from "./backlog-queries.mjs";
import { CliError } from "./backlog-errors.mjs";

function nextId(tasks) {
  let max = 0;
  for (const t of tasks) {
    const m = /^T-(\d{3})$/.exec(t.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `T-${String(max + 1).padStart(3, "0")}`;
}

function backupBeforeWrite(filePath, raw) {
  // 백업은 대상 파일(filePath) 바로 옆에 둔다 — --file로 격리된 사본을 지정했을 때
  // 실제 프로젝트 디렉터리를 오염시키지 않기 위함.
  const backupDir = path.join(path.dirname(filePath), ".backlog-backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.${stamp}.bak`);
  writeFileSync(backupPath, raw, "utf8");
  return backupPath;
}

function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, filePath); // 같은 파일시스템에서 rename은 원자적
}

/** 쓰기 전 재확인: 시작 시 읽었던 해시(및 --if-hash로 지정된 기대 해시)와 지금 디스크 상태가 같은지 검사. */
function guardConcurrentWrite(filePath, expectedHash, ifHashArg) {
  let currentRaw;
  try {
    currentRaw = readFileSync(filePath, "utf8");
  } catch (e) {
    throw new CliError(`쓰기 직전 재확인 실패 — 파일을 읽을 수 없습니다: ${e.message}`);
  }
  const currentHash = hashOf(currentRaw);
  if (currentHash !== expectedHash) {
    throw new CliError(
      `버전 충돌: 이 명령을 시작할 때 읽은 backlog와 지금 디스크의 backlog가 다릅니다 ` +
        `(그 사이 다른 변경이 들어옴). 시작 시 해시=${expectedHash.slice(0, 12)}…, 현재 해시=${currentHash.slice(0, 12)}…. ` +
        `원본은 수정하지 않았습니다. 다시 조회한 뒤 재시도하세요.`
    );
  }
  if (ifHashArg && !currentHash.startsWith(ifHashArg) && currentHash !== ifHashArg) {
    throw new CliError(
      `--if-hash로 지정한 해시(${ifHashArg})와 현재 backlog 해시(${currentHash.slice(0, 12)}…)가 다릅니다. ` +
        `원본은 수정하지 않았습니다.`
    );
  }
  return currentRaw;
}

function commitWrite(filePath, ctx, newData, ifHashArg) {
  const currentRaw = guardConcurrentWrite(filePath, ctx.hash, ifHashArg && ifHashArg !== true ? ifHashArg : undefined);
  backupBeforeWrite(filePath, currentRaw);
  const serialized = JSON.stringify(newData, null, 2) + "\n";
  atomicWrite(filePath, serialized);
}

/** backlog.json이 아직 없을 때만 빈 스캐폴드를 만든다. 이미 있으면 거부(덮어쓰기 금지). */
export function cmdInit(args, filePath, existsSync) {
  if (existsSync(filePath)) {
    throw new CliError(`이미 backlog.json이 존재합니다(${filePath}) — init은 최초 1회만 사용합니다.`);
  }
  const project = args.project && args.project !== true ? args.project : "";
  const source = args.source && args.source !== true ? args.source : "";
  const data = { schema_version: 1, project, source, tasks: [] };
  const errors = validateBacklog(data);
  if (errors.length > 0) {
    throw new CliError(`초기 스캐폴드가 스키마를 위반합니다:\n- ` + errors.join("\n- "));
  }
  atomicWrite(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`backlog.json 생성 완료: ${filePath}`);
  console.log(JSON.stringify(data, null, 2));
}

export function cmdAdd(args, ctx, filePath) {
  const missing = ["title", "category", "source-section"].filter((k) => !args[k] || args[k] === true);
  if (missing.length > 0) {
    throw new CliError(
      `필수 입력이 부족합니다: ${missing.join(", ")}. ` +
        `예: add --title "..." --category ip-management --source-section 4.1`
    );
  }

  if (!KNOWN_CATEGORIES.has(args.category)) {
    throw new CliError(
      `category '${args.category}'는 현재 backlog에 없는 값입니다. 기존 category: ${[...KNOWN_CATEGORIES].join(", ")}. ` +
        `새 category가 정말 필요하면 backlog-schema.mjs의 KNOWN_CATEGORIES를 먼저 갱신하세요(임의 추측 저장 방지).`
    );
  }

  const id = args.id && args.id !== true ? args.id : nextId(ctx.data.tasks);
  if (args.id && args.id !== true) {
    if (!ID_PATTERN.test(id)) {
      throw new CliError(`--id '${id}'가 기존 형식(T-XXX, 3자리 숫자)과 맞지 않습니다.`);
    }
    if (ctx.data.tasks.some((t) => t.id === id)) {
      throw new CliError(`id '${id}'는 이미 존재합니다.`);
    }
  }

  const status = args.status && args.status !== true ? args.status : "todo";
  if (!VALID_STATUS.has(status)) {
    throw new CliError(`--status 값이 올바르지 않습니다: '${status}' (허용: ${[...VALID_STATUS].join("/")})`);
  }

  const deps = args.deps && args.deps !== true ? args.deps.split(",").map((s) => s.trim()).filter(Boolean) : [];
  for (const dep of deps) {
    if (!ctx.data.tasks.some((t) => t.id === dep)) {
      throw new CliError(`--deps에 존재하지 않는 id '${dep}'가 있습니다.`);
    }
  }

  let parent;
  if (args.parent && args.parent !== true) {
    parent = args.parent;
    if (!ctx.data.tasks.some((t) => t.id === parent)) {
      throw new CliError(`--parent에 지정한 id '${parent}'가 존재하지 않습니다.`);
    }
  }

  const newTask = {
    id,
    title: args.title,
    category: args.category,
    source_section: args["source-section"],
    status,
  };
  if (deps.length > 0) newTask.deps = deps;
  if (parent) newTask.parent = parent;
  if (args.note && args.note !== true) newTask.note = args.note;
  if (status === "blocked" && !newTask.note) {
    throw new CliError(`status가 blocked인 태스크는 --note로 보류 사유를 반드시 적어야 합니다.`);
  }

  const candidateTasks = [...ctx.data.tasks, newTask];
  const cycle = findDependencyCycle(candidateTasks);
  if (cycle) {
    throw new CliError(`deps에 순환 의존성이 발견됐습니다: ${cycle.join(" -> ")}`);
  }

  const newData = { ...ctx.data, tasks: candidateTasks };
  const errors = validateBacklog(newData);
  if (errors.length > 0) {
    throw new CliError(`추가 결과가 스키마를 위반합니다:\n- ` + errors.join("\n- "));
  }

  commitWrite(filePath, ctx, newData, args["if-hash"]);
  console.log(`추가 완료: ${id}`);
  console.log(JSON.stringify(newTask, null, 2));
}

const DEPS_COMPLETION_STATUSES = new Set(["doing", "done"]);

export function cmdSetStatus(args, ctx, filePath) {
  const [id, newStatus] = args._;
  if (!id || !newStatus) {
    throw new CliError("set-status <id> <새 상태> 형태로 지정하세요.");
  }
  if (!VALID_STATUS.has(newStatus)) {
    throw new CliError(
      `'${newStatus}'는 이 프로젝트에 정의된 상태가 아닙니다(.claude/skills/backlog/SKILL.md 기준 허용 상태: ${[...VALID_STATUS].join("/")}). ` +
        `이 값이 맞는지 먼저 확인하세요 — CLI가 임의로 새 상태를 만들지 않습니다.`
    );
  }

  const task = findTask(ctx.data, id);
  const oldStatus = task.status;

  const tasksById = new Map(ctx.data.tasks.map((t) => [t.id, t]));
  if (DEPS_COMPLETION_STATUSES.has(newStatus)) {
    const unmet = (task.deps ?? []).filter((d) => tasksById.get(d)?.status !== "done");
    if (unmet.length > 0) {
      throw new CliError(
        `'${id}'를 '${newStatus}'로 바꾸려면 선행 작업이 먼저 done이어야 합니다 (SKILL.md 규칙). ` +
          `아직 미완료: ${unmet.join(", ")}`
      );
    }
  }

  if (newStatus === "done") {
    if (!args.evidence || args.evidence === true) {
      throw new CliError(
        `'${id}'를 done으로 바꾸려면 --evidence "<완료 근거>"가 필요합니다. ` +
          `이 프로젝트에는 자동으로 검사할 완료 조건(테스트/acceptance criteria)이 정의돼 있지 않아 ` +
          `사람이 적은 완료 근거를 note에 남기는 방식으로만 기록합니다.`
      );
    }
  }

  console.log(
    `참고: ${[...VALID_STATUS].join("/")} 사이의 일반 전이 규칙(예: 순서를 건너뛸 수 있는지)은 이 프로젝트에 정의돼 있지 않아 ` +
      `CLI가 별도로 막지 않습니다. deps 완료 여부(doing/done 진입 시)만 검증했습니다.`
  );

  const updatedTask = { ...task, status: newStatus };
  if (newStatus === "done" && args.evidence && args.evidence !== true) {
    updatedTask.note = updatedTask.note ? `${updatedTask.note} | 완료 근거: ${args.evidence}` : `완료 근거: ${args.evidence}`;
  } else if (args.note && args.note !== true) {
    updatedTask.note = args.note;
  }

  const newTasks = ctx.data.tasks.map((t) => (t.id === id ? updatedTask : t));
  const newData = { ...ctx.data, tasks: newTasks };
  const errors = validateBacklog(newData);
  if (errors.length > 0) {
    throw new CliError(`변경 결과가 스키마를 위반합니다:\n- ` + errors.join("\n- "));
  }

  commitWrite(filePath, ctx, newData, args["if-hash"]);
  console.log(`상태 변경 완료: ${id} ${oldStatus} -> ${newStatus}`);
  console.log(JSON.stringify(updatedTask, null, 2));
}

/** 기존 태스크의 deps 목록을 통째로 교체한다(부분 추가/삭제가 아니라 전체 지정). */
export function cmdSetDeps(args, ctx, filePath) {
  const id = args._[0];
  if (!id) throw new CliError("set-deps <id> --deps id1,id2 (빈 값이면 --deps \"\") 형태로 지정하세요.");
  if (args.deps === undefined) {
    throw new CliError(`--deps를 지정하세요. 선행 작업이 없으면 --deps ""로 명시적으로 비우세요.`);
  }

  const task = findTask(ctx.data, id);
  const oldDeps = task.deps ?? [];

  const newDeps =
    args.deps === true || args.deps === ""
      ? []
      : args.deps.split(",").map((s) => s.trim()).filter(Boolean);

  for (const dep of newDeps) {
    if (dep === id) throw new CliError(`'${id}'는 자기 자신을 deps로 가질 수 없습니다.`);
    if (!ctx.data.tasks.some((t) => t.id === dep)) {
      throw new CliError(`--deps에 존재하지 않는 id '${dep}'가 있습니다.`);
    }
  }

  const updatedTask = { ...task };
  if (newDeps.length > 0) updatedTask.deps = newDeps;
  else delete updatedTask.deps;

  const newTasks = ctx.data.tasks.map((t) => (t.id === id ? updatedTask : t));
  const cycle = findDependencyCycle(newTasks);
  if (cycle) {
    throw new CliError(`deps에 순환 의존성이 발견됐습니다: ${cycle.join(" -> ")}`);
  }

  const newData = { ...ctx.data, tasks: newTasks };
  const errors = validateBacklog(newData);
  if (errors.length > 0) {
    throw new CliError(`변경 결과가 스키마를 위반합니다:\n- ` + errors.join("\n- "));
  }

  commitWrite(filePath, ctx, newData, args["if-hash"]);
  console.log(`deps 변경 완료: ${id} [${oldDeps.join(",")}] -> [${newDeps.join(",")}]`);
  console.log(JSON.stringify(updatedTask, null, 2));
}
