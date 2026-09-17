import { getUsageSummary } from "@/lib/db/usage";
import { getQuotaByProject } from "@/lib/db/quota";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClockIcon, CheckIcon } from "@/components/dashboard/icons";

export const dynamic = "force-dynamic";

// T-028: 토큰 사용량 뷰. usage_logs가 D 항목(30일 TTL)에 따라 항상 최근 30일치만 남으므로
// 전체 합계를 내면 그대로 "최근 30일 사용량"이 된다.
// 2026-09-17 사용자 요청: 여기에 더해 `/status` 화면의 "이번 세션/이번 주 사용률(%)"도
// 프로젝트별로 같이 보여준다(기존 입력/출력 토큰 집계는 그대로 유지 — 대체가 아니라 추가).
export default async function UsagePage() {
  const [usage, quotas] = await Promise.all([getUsageSummary(), getQuotaByProject()]);

  return (
    <div className="page">
      <h1 className="page-title">토큰 사용량</h1>
      <p className="page-subtitle">최근 30일 집계 (그 이전 기록은 자동 삭제됩니다 — D 항목).</p>

      <section className="stat-grid stat-grid--2">
        <StatCard label="입력 토큰 합계" value={usage.totalInputTokens.toLocaleString("ko-KR")} color="blue" icon={<ClockIcon />} />
        <StatCard label="출력 토큰 합계" value={usage.totalOutputTokens.toLocaleString("ko-KR")} color="purple" icon={<CheckIcon />} />
      </section>

      <div className="card">
        <h2 className="card-title">/status 잔여량 (프로젝트별)</h2>
        {quotas.length === 0 ? (
          <p className="empty-state">
            아직 동기화된 값이 없습니다. <code>claudebridge run</code>이 실행 중이고, 세션이 유휴 상태일 때(생성 중이거나 입력 중이 아닐 때)까지 기다리면 최대 5분 내로 채워집니다.
          </p>
        ) : (
          <table className="usage-table">
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>이번 세션</th>
                <th>이번 주(전체 모델)</th>
                <th>마지막 확인</th>
              </tr>
            </thead>
            <tbody>
              {quotas.map((q) => (
                <tr key={q.projectId}>
                  <td>{q.name}</td>
                  <td>
                    {q.sessionPercentUsed}% used · Resets {q.sessionResetsAt}
                  </td>
                  <td>
                    {q.weekPercentUsed}% used · Resets {q.weekResetsAt}
                  </td>
                  <td>{new Date(q.updatedAt).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
