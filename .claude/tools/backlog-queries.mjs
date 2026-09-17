// backlog.json 읽기 전용 조회 로직 (list/show/ready). 절대 파일에 쓰지 않는다.
import { VALID_STATUS } from "./backlog-schema.mjs";
import { CliError } from "./backlog-errors.mjs";

export function findTask(data, id) {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) {
    const known = data.tasks.map((x) => x.id).sort().join(", ");
    throw new CliError(`id '${id}'를 찾을 수 없습니다. 존재하는 id: ${known}`);
  }
  return t;
}

export function isReady(task, tasksById) {
  if (task.status !== "todo") return false;
  for (const dep of task.deps ?? []) {
    const depTask = tasksById.get(dep);
    if (!depTask || depTask.status !== "done") return false;
  }
  return true;
}

function printTaskLine(t) {
  const depsStr = (t.deps ?? []).length ? ` deps=[${t.deps.join(",")}]` : "";
  const noteStr = t.note ? ` note="${t.note}"` : "";
  console.log(`${t.id}\t${t.status}\t${t.category}\t${t.title}${depsStr}${noteStr}`);
}

export function cmdList(args, ctx) {
  let tasks = ctx.data.tasks;
  if (args.status) {
    if (!VALID_STATUS.has(args.status)) {
      throw new CliError(`--status 값이 올바르지 않습니다: '${args.status}' (허용: ${[...VALID_STATUS].join("/")})`);
    }
    tasks = tasks.filter((t) => t.status === args.status);
  }
  if (args.category) {
    tasks = tasks.filter((t) => t.category === args.category);
  }

  if (args.json) {
    // 문서화 등 누락 없는 순회를 위한 원본 그대로의 전체 배열 출력(페이지네이션 없음).
    console.log(JSON.stringify({ sourceHash: ctx.hash, count: tasks.length, tasks }, null, 2));
    return;
  }

  console.log(`# backlog: ${ctx.data.project ?? ""} (sourceHash=${ctx.hash.slice(0, 12)}…, 총 ${ctx.data.tasks.length}개 중 ${tasks.length}개 표시)`);
  for (const t of tasks) printTaskLine(t);
}

export function cmdShow(args, ctx) {
  const id = args._[0];
  if (!id) throw new CliError("show <id> 형태로 id를 지정하세요.");
  const t = findTask(ctx.data, id);
  console.log(JSON.stringify({ sourceHash: ctx.hash, task: t }, null, 2));
}

export function cmdReady(args, ctx) {
  const tasksById = new Map(ctx.data.tasks.map((t) => [t.id, t]));
  const ready = ctx.data.tasks.filter((t) => isReady(t, tasksById));

  if (args.json) {
    console.log(JSON.stringify({ sourceHash: ctx.hash, count: ready.length, tasks: ready }, null, 2));
    return;
  }

  console.log(`# 진행 후보 (status=todo 이면서 모든 deps가 done): ${ready.length}건 (sourceHash=${ctx.hash.slice(0, 12)}…)`);
  for (const t of ready) printTaskLine(t);
}
