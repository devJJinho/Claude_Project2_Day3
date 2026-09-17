import { NextResponse } from "next/server";
import { deleteExpiredRecords } from "@/lib/db/cleanup";

// T-009 TTL의 두 번째 경로. Vercel Cron(vercel.json)이 매일 호출한다. Vercel은 crons에 등록된
// 경로를 호출할 때 CRON_SECRET 환경변수가 설정돼 있으면 `Authorization: Bearer $CRON_SECRET`
// 헤더를 자동으로 붙인다 — 그 값을 그대로 검증해 외부에서 이 경로를 함부로 호출하지 못하게
// 막는다. supabase/migrations의 pg_cron 스케줄과 조건이 같아 두 경로가 겹쳐 실행돼도 안전하다.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await deleteExpiredRecords();
    return NextResponse.json({ ok: true, deleted: result });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}
