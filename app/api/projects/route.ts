import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAuthorizedRegistrationRequest } from "@/lib/security/registration-token";
import { createOrReuseProject } from "@/lib/db/projects";

// T-040: 프로젝트 등록 API. 계약(다른 트랙 — .worktrees/agent-cli의 `claudebridge init`이
// 이 스펙대로 호출할 예정)은 최종 보고서에도 그대로 남긴다.
//
// POST /api/projects
// Headers: Authorization: Bearer <CLAUDEBRIDGE_REGISTRATION_TOKEN>
// Body(JSON): { "name": string(1~100자), "client_ref"?: string(1~200자) }
//   - client_ref: 같은 프로젝트 디렉터리에서 init을 다시 실행해도 중복 등록되지 않게 하는
//     선택적 idempotency 키(예: 절대경로의 해시). 생략하면 매번 새 프로젝트로 등록된다.
// 201 Created (신규): { "project_id": string, "name": string, "created_at": string, "existing": false }
// 200 OK        (client_ref로 기존 프로젝트 매칭): 위와 동일한 모양, "existing": true
// 400 Bad Request: { "error": "invalid_request", "message": string }
// 401 Unauthorized: { "error": "unauthorized" }
// 500 Internal Server Error: { "error": "internal_error", "message": string }

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  client_ref: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  if (!isAuthorizedRegistrationRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "요청 본문이 JSON이 아닙니다." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  try {
    const { project, existing } = await createOrReuseProject({
      name: parsed.data.name,
      clientRef: parsed.data.client_ref,
    });
    return NextResponse.json(
      { project_id: project.project_id, name: project.name, created_at: project.created_at, existing },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}
