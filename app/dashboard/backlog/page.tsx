import { getAllProjectBacklogs, KNOWN_STATUS_ORDER } from "@/lib/db/backlog";
import { RefreshControl } from "@/components/dashboard/RefreshControl";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
  blocked: "보류",
  needs_info: "확인 필요",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

// 사용자 요청(2026-09-17): "실제 프로젝트가 연결됐음에도 backlog.json 내용이 웹에서 안
// 보인다" — 등록된 각 프로젝트의 로컬 backlog.json 스냅샷(30초 주기로 로컬 에이전트가
// 동기화)을 프로젝트별 카드로 보여준다. Day_4_Project의 dashboard/index.html(읽기 전용
// backlog 뷰어)의 구성(전체 수, 상태별 건수, 상태 분포 바, 작업 목록)을 참고했다.
export default async function BacklogPage() {
  const backlogs = await getAllProjectBacklogs();

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">백로그</h1>
          <p className="page-subtitle">등록된 프로젝트의 로컬 backlog.json 최신 스냅샷입니다(로컬 에이전트가 주기적으로 동기화).</p>
        </div>
        <RefreshControl />
      </div>

      {backlogs.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            아직 동기화된 backlog.json이 없습니다. 대상 프로젝트에서 <code>claudebridge run</code>이 실행 중인지 확인하세요.
          </p>
        </div>
      ) : (
        backlogs.map((b) => {
          const done = b.byStatus.done ?? 0;
          const pctDone = b.totalCount > 0 ? Math.round((done / b.totalCount) * 100) : 0;
          return (
            <div className="card" key={b.projectId} style={{ marginBottom: "1.5rem" }}>
              <h2 className="card-title">{b.projectName ?? b.projectId}</h2>
              <p className="card-desc">
                전체 {b.totalCount}개 · 완료 {done}개 ({pctDone}%) · 마지막 동기화 {fmtTime(b.syncedAt)}
              </p>

              <div className="status-pill-row">
                {KNOWN_STATUS_ORDER.filter((s) => b.byStatus[s]).map((s) => (
                  <span key={s} className={`status-pill status-pill--${s}`}>
                    {STATUS_LABEL[s]} {b.byStatus[s]}
                  </span>
                ))}
              </div>

              <div className="status-bar">
                {KNOWN_STATUS_ORDER.filter((s) => b.byStatus[s]).map((s) => (
                  <div
                    key={s}
                    className={`status-bar-seg status-bar-seg--${s}`}
                    style={{ width: `${((b.byStatus[s] ?? 0) / b.totalCount) * 100}%` }}
                    title={`${STATUS_LABEL[s]}: ${b.byStatus[s]}개`}
                  />
                ))}
              </div>

              <div className="table-scroll">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th className="col-nowrap">ID</th>
                      <th className="col-nowrap">상태</th>
                      <th className="col-nowrap">카테고리</th>
                      <th>제목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.tasks.map((t) => (
                      <tr key={t.id}>
                        <td className="col-nowrap">{t.id}</td>
                        <td className="col-nowrap">
                          <span className={`status-pill status-pill--${t.status}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                        </td>
                        <td className="col-nowrap">{t.category}</td>
                        <td>{t.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
