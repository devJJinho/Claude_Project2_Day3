"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// T-026: AskUserQuestion 옵션 버튼. 자유 텍스트 입력창을 두지 않는다 — payload.options에 있는
// 값만 클릭으로 보낼 수 있다(개발요청서.md I 항목, 임의 명령 주입 경로 차단).
export function ResponseButtons({ eventId, options }: { eventId: string; options: string[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(choice: string) {
    setError(null);
    setSubmitting(choice);
    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, choice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "응답 전송에 실패했습니다.");
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(null);
    }
  }

  return (
    <div className="response-options">
      {options.map((opt) => (
        <button key={opt} className="option-btn" disabled={submitting !== null} onClick={() => handleClick(opt)}>
          {submitting === opt ? "전송 중…" : opt}
        </button>
      ))}
      {error && <p className="option-error">{error}</p>}
    </div>
  );
}
