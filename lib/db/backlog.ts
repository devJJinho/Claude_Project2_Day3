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

export { KNOWN_STATUS_ORDER };
