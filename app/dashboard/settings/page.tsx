import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PushSubscribeButton } from "@/components/dashboard/PushSubscribeButton";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="page">
      <h1 className="page-title">설정</h1>
      <p className="page-subtitle">계정 정보와 웹 푸시 알림 구독을 관리합니다.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">계정</h2>
        <p>{session?.user?.email}</p>
      </div>

      <div className="card">
        <h2 className="card-title">웹 푸시 알림</h2>
        <p className="card-desc">막힌 질문·권한이 생기면 이 브라우저로 즉시 알림을 받습니다(F 항목).</p>
        <PushSubscribeButton />
      </div>
    </div>
  );
}
