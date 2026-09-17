import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWhitelistedSessionEmail } from "@/lib/auth/session";
import { recordResponse, InvalidChoiceError, EventNotFoundError, EventAlreadyResolvedError } from "@/lib/db/responses";

// T-026: AskUserQuestion 응답 기록. choice는 반드시 이벤트 payload.options에 있는 값이어야
// 한다(자유 텍스트 금지, I 항목) — 검증은 lib/db/responses.ts에서 수행한다.
const schema = z.object({
  event_id: z.string().uuid(),
  choice: z.string().min(1).max(500),
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
      choice: parsed.data.choice,
      respondedBy: email,
      expectedType: "ask_user_question",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidChoiceError) return NextResponse.json({ error: "invalid_choice", message: err.message }, { status: 400 });
    if (err instanceof EventNotFoundError) return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    if (err instanceof EventAlreadyResolvedError) return NextResponse.json({ error: "already_resolved", message: err.message }, { status: 409 });
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}
