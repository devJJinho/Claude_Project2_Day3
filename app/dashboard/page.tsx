import { getEventStatusSummary, getPendingCountByProject } from "@/lib/db/events";
import { StatCard } from "@/components/dashboard/StatCard";
import { FolderIcon, BellIcon, ClockIcon, CheckIcon } from "@/components/dashboard/icons";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ProgressBar } from "@/components/dashboard/ProgressBar";

// 매 요청마다 최신 상태를 봐야 한다 — 로컬 에이전트가 수초~10초 간격으로 Supabase를 갱신하는
// 동안, 대시보드를 새로고침하면 항상 그 시점의 최신 값을 보여줘야 하므로 정적 캐시를 끈다.
export const dynamic = "force-dynamic";

// T-024: 상태 요약 통계 카드 4개 + 도넛(이벤트 상태 분포) + 프로젝트별 처리율 바.
export default async function DashboardPage() {
  const [summary, perProject] = await Promise.all([getEventStatusSummary(), getPendingCountByProject()]);

  return (
    <div className="page">
      <h1 className="page-title">대시보드</h1>
      <p className="page-subtitle">등록된 프로젝트의 Claude Code 세션 상태를 한눈에 확인하세요.</p>

      <section className="stat-grid">
        <StatCard label="전체 프로젝트" value={summary.totalProjects} color="purple" icon={<FolderIcon />} />
        <StatCard label="대기 중 질문·권한" value={summary.pendingCount} color="orange" icon={<BellIcon />} />
        <StatCard label="오늘 처리한 응답" value={summary.respondedToday} color="blue" icon={<ClockIcon />} />
        <StatCard label="전체 처리 완료" value={summary.resolvedTotal} color="green" icon={<CheckIcon />} />
      </section>

      <section className="panel-grid">
        <div className="card">
          <h2 className="card-title">이벤트 상태 분포</h2>
          <DonutChart
            centerLabel="대기 중"
            centerValue={summary.pendingCount}
            segments={[
              { label: "대기 중", value: summary.pendingCount, color: "var(--orange)" },
              { label: "처리 완료", value: summary.resolvedTotal, color: "var(--green)" },
            ]}
          />
        </div>
        <div className="card">
          <h2 className="card-title">프로젝트별 처리율</h2>
          {perProject.length === 0 ? (
            <p className="empty-state">등록된 프로젝트가 없습니다. claudebridge init으로 프로젝트를 등록하세요.</p>
          ) : (
            <div className="progress-list">
              {perProject.map((p) => (
                <ProgressBar key={p.projectId} label={p.name} resolved={p.total - p.pending} total={p.total} color="purple" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
