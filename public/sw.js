// T-032: 최소 서비스 워커. 실제 발송은 로컬 에이전트가 web-push로 수행하고(lib/db/push.ts
// 주석 참고), 이 파일은 브라우저가 그 push 이벤트를 받아 알림으로 보여주는 역할만 한다.
self.addEventListener("push", (event) => {
  let data = { title: "ClaudeBridge", body: "확인이 필요한 항목이 있습니다.", url: "/dashboard/pending" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      // 페이로드가 JSON이 아니면 기본 문구를 그대로 쓴다.
    }
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard/pending";
  event.waitUntil(self.clients.openWindow(targetUrl));
});
