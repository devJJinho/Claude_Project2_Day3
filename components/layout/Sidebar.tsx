"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";

// K 항목: 좌측 고정 사이드바(대시보드/대기 질문·권한/토큰 사용량/설정) + 하단 "프로젝트 전환"
// 진입점(다중 프로젝트 확장 대비 자리만 — G 항목상 1차 범위는 단일 프로젝트라 비활성 처리).
const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/pending", label: "대기 질문·권한" },
  { href: "/dashboard/usage", label: "토큰 사용량" },
  { href: "/dashboard/settings", label: "설정" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">ClaudeBridge</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={`sidebar-link${pathname === item.href ? " active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-link project-switch" disabled title="다중 프로젝트 관리는 이후 버전에서 지원합니다">
          + 프로젝트 전환
        </button>
        <div className="sidebar-user">
          <span>{userEmail}</span>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
