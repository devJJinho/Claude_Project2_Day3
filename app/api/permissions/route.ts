import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWhitelistedSessionEmail } from "@/lib/auth/session";
import { recordResponse, InvalidChoiceError, EventNotFoundError, EventAlreadyResolvedError } from "@/lib/db/responses";

// T-027: Permission 승인/거부 기록. decision은 'approve'|'deny' 둘 중 하나만 허용한다(I 항목).
//
// 중요: 이 API는 웹 쪽 기록만 담당한다. "1단계 안전 게이트(위험 명령어 차단 훅)가 살아있을
// 때만 실제로 tmux에 주입한다"는 개발요청서.md I 항목의 규칙은 로컬 에이전트
// (.worktrees/agent-cli)가 이 responses 테이블을 폴링해 주입하기 직전에 반드시 확인해야 하는
// 책임이다 — Vercel에서 실행되는 이 웹 앱은 로컬 머신의 훅 상태를 알 수 없으므로 여기서는
// 검증할 수 없다.
const schema = z.object({
  event_id: z.string().uuid(),
  decision: z.enum(["approve", "deny"]),
});

export async function POST(request: Request) {
  const email = await requireWhitelistedSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  try {
    await recordResponse({
      eventId: parsed.data.event_id,
      choice: parsed.data.decision,
      respondedBy: email,
      expectedType: "permission",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidChoiceError) return NextResponse.json({ error: "invalid_choice", message: err.message }, { status: 400 });
    if (err instanceof EventNotFoundError) return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    if (err instanceof EventAlreadyResolvedError) return NextResponse.json({ error: "already_resolved", message: err.message }, { status: 409 });
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}
