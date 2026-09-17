"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon } from "./icons";

const PULL_THRESHOLD_PX = 70;

// 사용자 요청(2026-09-18): 백로그 화면에 새로고침 버튼 + 모바일 웹에서 아래로 당겨서
// 새로고침(pull-to-refresh). 페이지는 force-dynamic 서버 컴포넌트라 router.refresh()만
// 호출하면 전체 리로드 없이 서버에서 최신 backlog 스냅샷을 다시 가져온다.
export function RefreshControl() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const startY = useRef<number | null>(null);
  const pullPxRef = useRef(0);

  function doRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 700);
  }

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      const next = delta > 0 ? Math.min(delta, PULL_THRESHOLD_PX * 1.5) : 0;
      pullPxRef.current = next;
      setPullPx(next);
    }
    function onTouchEnd() {
      if (startY.current == null) return;
      if (pullPxRef.current >= PULL_THRESHOLD_PX) doRefresh();
      startY.current = null;
      pullPxRef.current = 0;
      setPullPx(0);
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div className="refresh-control">
      {pullPx > 0 && (
        <div className="pull-refresh-indicator" style={{ height: pullPx }}>
          {pullPx >= PULL_THRESHOLD_PX ? "놓으면 새로고침" : "아래로 당겨서 새로고침"}
        </div>
      )}
      <button className="ghost-btn refresh-btn" onClick={doRefresh} disabled={refreshing} title="새로고침">
        <span className={`refresh-icon${refreshing ? " refresh-icon--spinning" : ""}`}>
          <RefreshIcon />
        </span>
        새로고침
      </button>
    </div>
  );
}
