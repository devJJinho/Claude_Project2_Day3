import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectRow } from "@/lib/supabase/types";

// project_id 발급 규칙(T-040): 사람이 읽기 쉬운 접두사 + uuid에서 하이픈을 뺀 앞 20자.
// tmux 세션 이름(`tmux new -s <project_id>`)이나 URL 쿼리에 그대로 쓰이므로 영숫자만 남긴다.
function generateProjectId(): string {
  return `clb_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`프로젝트 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

export async function findProjectByClientRef(clientRef: string): Promise<ProjectRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("*")
    .eq("client_ref", clientRef)
    .maybeSingle();
  if (error) throw new Error(`client_ref 조회 실패: ${error.message}`);
  return data ?? null;
}

export interface CreateProjectResult {
  project: ProjectRow;
  existing: boolean;
}

/**
 * T-040 API 계약의 핵심 동작: client_ref가 이미 등록돼 있으면 기존 프로젝트를 그대로
 * 반환하고(existing=true), 없으면 새 project_id를 발급해 등록한다(existing=false).
 * `claudebridge init`을 같은 디렉터리에서 여러 번 실행해도 프로젝트가 중복 생성되지 않게
 * 하기 위함이다.
 */
export async function createOrReuseProject(input: {
  name: string;
  clientRef?: string;
}): Promise<CreateProjectResult> {
  if (input.clientRef) {
    const existing = await findProjectByClientRef(input.clientRef);
    if (existing) return { project: existing, existing: true };
  }

  const projectId = generateProjectId();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .insert({ project_id: projectId, name: input.name, client_ref: input.clientRef ?? null })
    .select("*")
    .single();
  if (error) throw new Error(`프로젝트 등록 실패: ${error.message}`);
  return { project: data, existing: false };
}
