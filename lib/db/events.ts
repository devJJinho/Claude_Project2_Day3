import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BlockedEventRow, ProjectRow } from "@/lib/supabase/types";

// PostgREST의 자동 관계 임베딩(`select('*, projects(name)')`)에 기대지 않고 두 번 조회해
// 조합한다 — 실제 Supabase 프로젝트가 아직 없어(T-003 대기) 임베딩 문법이 이 스키마에서
// 그대로 동작하는지 확인할 수 없는 상태라, 항상 동작이 보장되는 단순한 방식을 택했다.
export interface PendingEventWithProject extends BlockedEventRow {
  projectName: string;
}

export async function listPendingEvents(limit = 50): Promise<PendingEventWithProject[]> {
  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from("blocked_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`대기 이벤트 조회 실패: ${error.message}`);
  if (!events || events.length === 0) return [];

  const projectIds = [...new Set(events.map((e) => e.project_id))];
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("project_id, name")
    .in("project_id", projectIds);
  if (projErr) throw new Error(`프로젝트 이름 조회 실패: ${projErr.message}`);

  const nameById = new Map((projects ?? []).map((p: Pick<ProjectRow, "project_id" | "name">) => [p.project_id, p.name]));
  return events.map((e) => ({ ...e, projectName: nameById.get(e.project_id) ?? e.project_id }));
}

export async function getEventById(id: string): Promise<BlockedEventRow | null> {
  const { data, error } = await getSupabaseAdmin().from("blocked_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`이벤트 조회 실패: ${error.message}`);
  return data ?? null;
}

export interface EventStatusSummary {
  totalProjects: number;
  pendingCount: number;
  respondedToday: number;
  resolvedTotal: number;
}

export async function getEventStatusSummary(): Promise<EventStatusSummary> {
  const supabase = getSupabaseAdmin();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ count: totalProjects }, { count: pendingCount }, { count: resolvedTotal }, { count: respondedToday }] =
    await Promise.all([
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("blocked_events").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("responses").select("*", { count: "exact", head: true }),
      supabase.from("responses").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    ]);

  return {
    totalProjects: totalProjects ?? 0,
    pendingCount: pendingCount ?? 0,
    respondedToday: respondedToday ?? 0,
    resolvedTotal: resolvedTotal ?? 0,
  };
}

/** 프로젝트별 대기/전체 이벤트 수 — 대시보드의 "프로젝트별 진행률" 바 차트용(T-024). */
export async function getPendingCountByProject(): Promise<{ projectId: string; name: string; pending: number; total: number }[]> {
  const supabase = getSupabaseAdmin();
  const { data: projects, error } = await supabase.from("projects").select("project_id, name");
  if (error) throw new Error(`프로젝트 목록 조회 실패: ${error.message}`);
  if (!projects || projects.length === 0) return [];

  const results = await Promise.all(
    projects.map(async (p: Pick<ProjectRow, "project_id" | "name">) => {
      const [{ count: total }, { count: pending }] = await Promise.all([
        supabase.from("blocked_events").select("*", { count: "exact", head: true }).eq("project_id", p.project_id),
        supabase
          .from("blocked_events")
          .select("*", { count: "exact", head: true })
          .eq("project_id", p.project_id)
          .eq("status", "pending"),
      ]);
      return { projectId: p.project_id, name: p.name, pending: pending ?? 0, total: total ?? 0 };
    })
  );
  return results;
}
