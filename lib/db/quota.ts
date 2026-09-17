import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectRow, UsageQuotaRow } from "@/lib/supabase/types";

export interface ProjectQuota {
  projectId: string;
  name: string;
  sessionPercentUsed: number;
  sessionResetsAt: string;
  weekPercentUsed: number;
  weekResetsAt: string;
  updatedAt: string;
}

// 사용자 요청(2026-09-17): 기존 입력/출력 토큰 합계(usage.ts)는 그대로 유지하고, 로컬
// 에이전트가 /status를 스크래핑해 올리는 "이번 세션/이번 주 사용률(%)"을 프로젝트별로
// 추가로 보여준다. 에이전트가 아직 한 번도 동기화하지 못했으면(quota-scraper.mjs가 매번
// 건너뛰었거나 daemon을 아직 안 띄웠으면) 그 프로젝트는 목록에서 빠진다 — 없는 값을
// 0%로 지어내지 않는다.
export async function getQuotaByProject(): Promise<ProjectQuota[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: quotas, error: quotaError }, { data: projects, error: projectsError }] = await Promise.all([
    supabase.from("usage_quota").select("*"),
    supabase.from("projects").select("project_id, name"),
  ]);
  if (quotaError) throw new Error(`usage_quota 조회 실패: ${quotaError.message}`);
  if (projectsError) throw new Error(`프로젝트 조회 실패: ${projectsError.message}`);

  const nameById = new Map((projects ?? []).map((p: Pick<ProjectRow, "project_id" | "name">) => [p.project_id, p.name]));

  return ((quotas ?? []) as UsageQuotaRow[]).map((q) => ({
    projectId: q.project_id,
    name: nameById.get(q.project_id) ?? q.project_id,
    sessionPercentUsed: q.session_percent_used,
    sessionResetsAt: q.session_resets_at,
    weekPercentUsed: q.week_percent_used,
    weekResetsAt: q.week_resets_at,
    updatedAt: q.updated_at,
  }));
}
