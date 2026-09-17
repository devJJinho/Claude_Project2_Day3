"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";

// K 항목: 좌측 고정 사이드바(대시보드/대기 질문·권한/토큰 사용량/설정) + 하단 "프로젝트 전환"
// 진입점(다중 프로젝트 확장 대비 자리만 — G 항목상 1차 범위는 단일 프로젝트라 비활성 처리).
const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/pending", label: "대기 질문·권한" },
  { href: "/dashboard/backlog", label: "백로그" },
  { href: "/dashboard/usage", label: "토큰 사용량" },
  { href: "/dashboard/settings", label: "설정" },
];

// 프로젝트 전환/계정 정보 — 데스크톱에서는 사이드바 하단에, 모바일(좁은 화면)에서는
// 화면 전체 콘텐츠 맨 아래(AccountBar로 별도 렌더링)에 보이게 한다(사용자 요청
// 2026-09-18: 모바일에서 이 블록이 사이드바 nav와 함께 맨 위쪽에 몰려 있어 하단으로
// 내려달라는 요청 — 실제로는 sidebar 안에 중첩돼 있어 CSS order만으로는 app-main
// 아래로 옮길 수 없어, 같은 내용을 두 곳에 렌더링하고 미디어 쿼리로 하나만 보이게 함).
function AccountInfo({ userEmail }: { userEmail: string }) {
  return (
    <>
      <button className="sidebar-link project-switch" disabled title="다중 프로젝트 관리는 이후 버전에서 지원합니다">
        + 프로젝트 전환
      </button>
      <div className="sidebar-user">
        <span>{userEmail}</span>
        <SignOutButton />
      </div>
    </>
  );
}

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
      <div className="sidebar-footer sidebar-footer--desktop">
        <AccountInfo userEmail={userEmail} />
      </div>
    </aside>
  );
}

// layout.tsx가 <main> 다음의 형제 요소로 렌더링한다 — app-shell이 모바일에서 세로로
// 쌓일 때 DOM 순서상 자연스럽게 맨 아래에 온다. 데스크톱에서는 CSS로 숨긴다.
export function MobileAccountBar({ userEmail }: { userEmail: string }) {
  return (
    <div className="sidebar-footer sidebar-footer--mobile">
      <AccountInfo userEmail={userEmail} />
    </div>
  );
}
