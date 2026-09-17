import { getUsageSummary } from "@/lib/db/usage";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockIcon, CheckIcon } from "@/components/dashboard/icons";

export const dynamic = "force-dynamic";

// T-028: 토큰 사용량 뷰. usage_logs가 D 항목(30일 TTL)에 따라 항상 최근 30일치만 남으므로
// 전체 합계를 내면 그대로 "최근 30일 사용량"이 된다.
export default async function UsagePage() {
  const usage = await getUsageSummary();

  return (
    <div className="page">
      <h1 className="page-title">토큰 사용량</h1>
      <p className="page-subtitle">최근 30일 집계 (그 이전 기록은 자동 삭제됩니다 — D 항목).</p>

      <section className="stat-grid stat-grid--2">
        <StatCard label="입력 토큰 합계" value={usage.totalInputTokens.toLocaleString("ko-KR")} color="blue" icon={<ClockIcon />} />
        <StatCard label="출력 토큰 합계" value={usage.totalOutputTokens.toLocaleString("ko-KR")} color="purple" icon={<CheckIcon />} />
      </section>

      <div className="card">
        <h2 className="card-title">프로젝트별 사용량</h2>
        {usage.byProject.length === 0 ? (
          <p className="empty-state">
            아직 기록된 사용량이 없습니다. 로컬 세션 로그 위치/포맷 조사(T-029)가 끝나야 로컬 에이전트가 이 값을 채웁니다.
          </p>
        ) : (
          <table className="usage-table">
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>입력 토큰</th>
                <th>출력 토큰</th>
              </tr>
            </thead>
            <tbody>
              {usage.byProject.map((p) => (
                <tr key={p.projectId}>
                  <td>{p.name}</td>
                  <td>{p.inputTokens.toLocaleString("ko-KR")}</td>
                  <td>{p.outputTokens.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
