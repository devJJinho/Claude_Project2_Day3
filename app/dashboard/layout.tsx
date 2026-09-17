import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Sidebar, MobileAccountBar } from "@/components/layout/Sidebar";

// middleware.ts가 /dashboard/** 전체를 이미 화이트리스트 세션으로 보호하므로, 여기서는 사이드바에
// 표시할 이메일만 가져온다(중복 리다이렉트 로직을 두지 않는다).
//
// MobileAccountBar를 <main> 뒤에 형제로 둔 이유(사용자 요청 2026-09-18): 모바일 폭에서
// app-shell이 세로로 쌓일 때 프로젝트 전환/계정 정보가 항상 맨 위(사이드바 nav와 함께)에
// 몰려 있었다 — Sidebar 안에 중첩된 요소라 CSS order만으로는 app-main 아래로 옮길 수
// 없어, DOM 순서 자체를 main 다음으로 두고 데스크톱에서는 CSS로 숨긴다.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? "";
  return (
    <div className="app-shell">
      <Sidebar userEmail={userEmail} />
      <main className="app-main">{children}</main>
      <MobileAccountBar userEmail={userEmail} />
    </div>
  );
}
