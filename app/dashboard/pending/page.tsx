import { listPendingEvents } from "@/lib/db/events";
import { formatRelativeTime } from "@/lib/time";
import { ResponseButtons } from "@/components/dashboard/ResponseButtons";
import { PermissionButtons } from "@/components/dashboard/PermissionButtons";
import type { AskUserQuestionPayload, PermissionPayload } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// T-025~027: 대기 중인 질문/권한 목록. 색상 바(파랑=질문/주황=권한)와 발생 시각으로 구분하고,
// 가장 오래 기다린 항목이 위로 오게 정렬한다(listPendingEvents가 created_at asc로 정렬).
export default async function PendingPage() {
  const events = await listPendingEvents();

  return (
    <div className="page">
      <h1 className="page-title">대기 중인 질문·권한</h1>
      <p className="page-subtitle">오래 기다린 항목이 위에 표시됩니다.</p>

      {events.length === 0 ? (
        <div className="card empty-state">지금은 대기 중인 항목이 없습니다.</div>
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
