import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectRow, UsageLogRow } from "@/lib/supabase/types";

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  byProject: { projectId: string; name: string; inputTokens: number; outputTokens: number }[];
}

// D 항목(30일 TTL)에 따라 usage_logs에는 어차피 최근 30일치만 남아있으므로, 전체를 읽어
// 합산하면 그대로 "최근 30일 사용량"이 된다.
export async function getUsageSummary(): Promise<UsageSummary> {
  const supabase = getSupabaseAdmin();
  const [{ data: logs, error: logsError }, { data: projects, error: projectsError }] = await Promise.all([
    supabase.from("usage_logs").select("project_id, input_tokens, output_tokens"),
    supabase.from("projects").select("project_id, name"),
  ]);
  if (logsError) throw new Error(`사용량 조회 실패: ${logsError.message}`);
  if (projectsError) throw new Error(`프로젝트 조회 실패: ${projectsError.message}`);

  const nameById = new Map((projects ?? []).map((p: Pick<ProjectRow, "project_id" | "name">) => [p.project_id, p.name]));
  const totals = new Map<string, { inputTokens: number; outputTokens: number }>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const log of (logs ?? []) as Pick<UsageLogRow, "project_id" | "input_tokens" | "output_tokens">[]) {
    totalInputTokens += log.input_tokens;
    totalOutputTokens += log.output_tokens;
    const acc = totals.get(log.project_id) ?? { inputTokens: 0, outputTokens: 0 };
    acc.inputTokens += log.input_tokens;
    acc.outputTokens += log.output_tokens;
    totals.set(log.project_id, acc);
  }

  const byProject = [...totals.entries()].map(([projectId, v]) => ({
    projectId,
    name: nameById.get(projectId) ?? projectId,
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
  }));

  return { totalInputTokens, totalOutputTokens, byProject };
}
