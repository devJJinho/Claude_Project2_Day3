import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWhitelistedSessionEmail } from "@/lib/auth/session";
import { upsertPushSubscription } from "@/lib/db/push";

// T-032: 브라우저의 PushSubscription.toJSON() 결과를 그대로 받는다.
const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
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
    await upsertPushSubscription({
      userEmail: email,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}
