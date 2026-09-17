import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BacklogSnapshotRow, BacklogTask } from "@/lib/supabase/types";

export interface ProjectBacklog {
  projectId: string;
  projectName: string | null;
  syncedAt: string;
  tasks: BacklogTask[];
  totalCount: number;
  byStatus: Record<string, number>;
}

const KNOWN_STATUS_ORDER = ["todo", "doing", "done", "blocked", "needs_info"] as const;

function summarize(row: BacklogSnapshotRow): ProjectBacklog {
  const byStatus: Record<string, number> = {};
  for (const t of row.tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    syncedAt: row.synced_at,
    tasks: row.tasks,
    totalCount: row.tasks.length,
    byStatus,
  };
}

// 사용자 요청(2026-09-17): "실제 프로젝트가 연결됐음에도 backlog.json 내용이 웹에서 안
// 보인다" — 로컬 에이전트(backlog-sync.mjs)가 30초 주기로 올리는 최신 스냅샷을 그대로
// 보여준다. 한 번도 동기화 안 됐으면(daemon 미실행 등) 빈 배열.
export async function getAllProjectBacklogs(): Promise<ProjectBacklog[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("project_backlog_snapshot").select("*").order("synced_at", { ascending: false });
  if (error) throw new Error(`project_backlog_snapshot 조회 실패: ${error.message}`);
  return ((data ?? []) as BacklogSnapshotRow[]).map(summarize);
}

export interface NeedsInfoBacklogItem {
  projectId: string;
  projectName: string | null;
  task: BacklogTask;
}

// T-048(사용자 요청 2026-09-17): "확인 필요(needs_info)" 백로그 태스크를 대기 질문·권한
// 탭에도 같이 보여주기 위한 조회. 라이브 blocked_events와 달리 이 항목들은 응답 버튼이
// 없다 — 실제 처리는 사람이 외부에서(예: OAuth 클라이언트 발급) 해결한 뒤 로컬에서 직접
// backlog 상태를 바꾸는 것이라 tmux 주입 대상이 아니다(I 항목: 임의 텍스트 주입 경로를
// 새로 만들지 않음).
export async function getNeedsInfoBacklogItems(): Promise<NeedsInfoBacklogItem[]> {
  const backlogs = await getAllProjectBacklogs();
  const items: NeedsInfoBacklogItem[] = [];
  for (const b of backlogs) {
    for (const task of b.tasks) {
      if (task.status === "needs_info") {
        items.push({ projectId: b.projectId, projectName: b.projectName, task });
      }
    }
  }
  return items;
}

export { KNOWN_STATUS_ORDER };
