import { listPendingEvents } from "@/lib/db/events";
import { getNeedsInfoBacklogItems } from "@/lib/db/backlog";
import { formatRelativeTime } from "@/lib/time";
import { ResponseButtons } from "@/components/dashboard/ResponseButtons";
import { PermissionButtons } from "@/components/dashboard/PermissionButtons";
import type { AskUserQuestionPayload, PermissionPayload } from "@/lib/supabase/types";
import { RefreshControl } from "@/components/dashboard/RefreshControl";

export const dynamic = "force-dynamic";

// T-025~027: 대기 중인 질문/권한 목록. 색상 바(파랑=질문/주황=권한)와 발생 시각으로 구분하고,
// 가장 오래 기다린 항목이 위로 오게 정렬한다(listPendingEvents가 created_at asc로 정렬).
//
// T-048(사용자 요청 2026-09-17): 라이브 이벤트 목록 아래에 backlog needs_info 태스크도
// 같은 "확인 필요" 개념으로 이어 붙인다 — 이쪽은 응답 버튼이 없다(사람이 외부에서 처리).
export default async function PendingPage() {
  const [events, needsInfoItems] = await Promise.all([listPendingEvents(), getNeedsInfoBacklogItems()]);

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">대기 중인 질문·권한</h1>
          <p className="page-subtitle">오래 기다린 항목이 위에 표시됩니다.</p>
        </div>
        <RefreshControl />
      </div>

      {events.length === 0 ? (
        <div className="card empty-state">지금은 대기 중인 질문·권한이 없습니다.</div>
      ) : (
        <ul className="pending-list">
          {events.map((event) => (
            <li key={event.id} className={`pending-item pending-item--${event.type}`}>
              <div className="pending-item-bar" />
              <div className="pending-item-body">
                <div className="pending-item-meta">
                  <span className={`badge badge--${event.type}`}>
                    {event.type === "ask_user_question" ? "질문" : "권한"}
                  </span>
                  <span className="pending-item-project">{event.projectName}</span>
                  <span className="pending-item-time">{formatRelativeTime(event.created_at)}</span>
                </div>

                {event.type === "ask_user_question" ? (
                  <QuestionBody payload={event.payload as AskUserQuestionPayload} eventId={event.id} />
                ) : (
                  <PermissionBody payload={event.payload as PermissionPayload} eventId={event.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">백로그 확인 필요</h2>
      <p className="page-subtitle">
        연결된 프로젝트의 backlog.json에서 사람의 확인이 필요하다고 표시된 태스크입니다(외부 계정 발급 등 —
        여기서 바로 응답할 수는 없고, 처리 후 해당 프로젝트에서 직접 상태를 바꿔야 합니다).
      </p>
      {needsInfoItems.length === 0 ? (
        <div className="card empty-state">확인이 필요한 백로그 태스크가 없습니다.</div>
      ) : (
        <ul className="pending-list">
          {needsInfoItems.map((item) => (
            <li key={`${item.projectId}-${item.task.id}`} className="pending-item pending-item--needs_info">
              <div className="pending-item-bar" />
              <div className="pending-item-body">
                <div className="pending-item-meta">
                  <span className="badge badge--needs_info">확인 필요</span>
                  <span className="pending-item-project">{item.projectName ?? item.projectId}</span>
                </div>
                <p className="pending-item-text">
                  <code>{item.task.id}</code> {item.task.title}
                </p>
                {item.task.note && <p className="pending-item-desc">{item.task.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionBody({ payload, eventId }: { payload: AskUserQuestionPayload; eventId: string }) {
  return (
    <>
      <p className="pending-item-text">{payload.question}</p>
      <ResponseButtons eventId={eventId} options={payload.options} />
    </>
  );
}

function PermissionBody({ payload, eventId }: { payload: PermissionPayload; eventId: string }) {
  return (
    <>
      <p className="pending-item-text">
        <code>{payload.tool}</code> {payload.command}
      </p>
      {payload.description && <p className="pending-item-desc">{payload.description}</p>}
      <PermissionButtons eventId={eventId} />
    </>
  );
}
