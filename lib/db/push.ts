import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface PushSubscriptionInput {
  userEmail: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// endpoint가 unique라 같은 브라우저가 재구독해도 upsert로 갱신될 뿐 중복 행이 쌓이지 않는다.
export async function upsertPushSubscription(input: PushSubscriptionInput): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      { user_email: input.userEmail, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth },
      { onConflict: "endpoint" }
    );
  if (error) throw new Error(`푸시 구독 저장 실패: ${error.message}`);
}
