// 브라우저 번들에 포함돼도 안전한 값만 여기 둔다. Next.js 규약상 NEXT_PUBLIC_ 접두사가 붙은
// 값만 클라이언트에서 읽힌다. Supabase는 이 앱에서 브라우저가 직접 호출하지 않으므로(모든 DB
// 접근은 서버에서 서비스 롤 키로 수행, lib/supabase/admin.ts) 이 목록에 Supabase 키는 없다.
export const publicEnv = {
  // 웹 푸시 구독 시 브라우저에 넘길 VAPID 공개키(T-032). 개인키는 발송을 담당하는 로컬
  // 에이전트(.worktrees/agent-cli) 쪽에만 있으면 되고 이 웹 앱에는 필요 없다.
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};
