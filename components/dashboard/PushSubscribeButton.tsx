"use client";

import { useState } from "react";
import { publicEnv } from "@/lib/env/public";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "idle" | "loading" | "done" | "error";

// T-032: 브라우저 Push 구독 등록. 실제 발송은 로컬 에이전트가 담당하므로(lib/db/push.ts 주석
// 참고) 이 컴포넌트는 구독을 만들어 서버에 저장하는 것까지만 한다.
export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubscribe() {
    setStatus("loading");
    setMessage(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("이 브라우저는 웹 푸시를 지원하지 않습니다.");
      }
      if (!publicEnv.vapidPublicKey) {
        throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY가 설정되지 않았습니다.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("알림 권한이 거부되었습니다.");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // 최신 TS DOM 타입은 ArrayBuffer/SharedArrayBuffer를 엄격히 구분해 Uint8Array를 그대로
        // 대입하면 타입 에러가 난다 — PushManager.subscribe는 실제로는 BufferSource를 받으므로
        // 안전하게 캐스팅한다.
        applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("구독 등록에 실패했습니다.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="push-subscribe">
      <button className="primary-btn" onClick={handleSubscribe} disabled={status === "loading" || status === "done"}>
        {status === "done" ? "알림 구독 완료" : status === "loading" ? "구독하는 중…" : "이 브라우저에서 푸시 알림 받기"}
      </button>
      {message && <p className="push-subscribe-error">{message}</p>}
    </div>
  );
}
