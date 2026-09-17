"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// T-027: Permission 승인/거부 버튼. 두 값(approve/deny) 외에는 아무것도 보낼 수 없다.
export function PermissionButtons({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(decision: "approve" | "deny") {
    setError(null);
    setSubmitting(decision);
    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, decision }),
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
    <div className="permission-options">
      <button className="approve-btn" disabled={submitting !== null} onClick={() => handleClick("approve")}>
        {submitting === "approve" ? "승인 중…" : "승인"}
      </button>
      <button className="deny-btn" disabled={submitting !== null} onClick={() => handleClick("deny")}>
        {submitting === "deny" ? "거부 중…" : "거부"}
      </button>
      {error && <p className="option-error">{error}</p>}
    </div>
  );
}
