import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Sidebar } from "@/components/layout/Sidebar";

// middleware.ts가 /dashboard/** 전체를 이미 화이트리스트 세션으로 보호하므로, 여기서는 사이드바에
// 표시할 이메일만 가져온다(중복 리다이렉트 로직을 두지 않는다).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <div className="app-shell">
      <Sidebar userEmail={session?.user?.email ?? ""} />
      <main className="app-main">{children}</main>
    </div>
  );
}
