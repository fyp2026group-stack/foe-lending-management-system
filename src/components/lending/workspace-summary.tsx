'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLending } from './shared';
import type { Page, BorrowRequest, Loan, HistoryEvent, Allocation } from './api';

export function WorkspaceSummary({ session }: { session: Session }) {
  const requests = useLending<Page<BorrowRequest>>('requests', 0);
  const loans = useLending<Page<Loan>>('loans', 0);
  const history = useLending<Page<HistoryEvent>>('history', 0);
  const allocations = useLending<Page<Allocation>>('allocations', 0);
  const [now] = useState(() => Date.now());
  const assigned =
    requests.data?.items.flatMap((request) =>
      request.lines
        .filter(
          (line) =>
            request.borrowerId !== session.user.id &&
            ((line.stage === 'LECTURER' &&
              line.lecturerId === session.user.id &&
              session.user.roles.includes('LECTURER')) ||
              (line.stage === 'HOD' &&
                line.hodId === session.user.id &&
                session.user.roles.includes('ADMIN')))
        )
        .map((line) => ({ request, line }))
    ) ?? [];
  const mine =
    requests.data?.items.filter((request) => request.borrowerId === session.user.id) ?? [];
  const overdue =
    loans.data?.items.filter(
      (loan) =>
        loan.returned < loan.quantity && Boolean(loan.dueAt && new Date(loan.dueAt).getTime() < now)
    ) ?? [];
  const ready = allocations.data?.items.filter((row) => row.issued < row.quantity) ?? [];
  const reviewer = session.user.roles.some((role) => ['ADMIN', 'LECTURER'].includes(role));
  const technical = session.user.roles.includes('TECHNICAL_OFFICER');
  return (
    <div className="dashboard-columns work-summary">
      <section className="records dashboard-list">
        <div className="section-heading">
          <h2>Work requiring attention</h2>
          <Badge variant="secondary">Current scope</Badge>
        </div>
        {[requests.error, loans.error, allocations.error].filter(Boolean).map((error, index) => (
          <ErrorNotice key={index} message={error!} />
        ))}
        {!requests.data && !requests.error ? (
          <div role="status" className="loading-rows">
            <span className="sr-only">Loading pending work</span>
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {reviewer && (
              <Link href="/borrowing?view=approvals">
                <span>{assigned.length} lines awaiting your decision</span>
                <small>Only lecturer or HOD stages currently assigned to you</small>
              </Link>
            )}
            {technical && allocations.data && (
              <Link href="/borrowing?view=collection">
                <span>{ready.length} reservations ready for handover</span>
                <small>Check the borrower, quantity and equipment serial</small>
              </Link>
            )}
            <Link href="/borrowing?view=requests">
              <span>{mine.length} requests submitted by you</span>
              <small>Track approval stages and collection readiness</small>
            </Link>
          </>
        )}
        {loans.data && (
          <Link href="/borrowing?view=loans">
            <span>{overdue.length} overdue borrowed equipment in your scope</span>
            <small>
              {overdue.length
                ? 'Review outstanding equipment and due dates'
                : 'No overdue equipment in the current records'}
            </small>
          </Link>
        )}
      </section>
      <section className="records activity-list">
        <div className="section-heading">
          <h2>Recent lending activity</h2>
          <Link className="text-link" href="/borrowing?view=history">
            View history
          </Link>
        </div>
        {history.error && <ErrorNotice message={history.error} />}
        {!history.data && !history.error && (
          <div role="status" className="loading-rows">
            <span className="sr-only">Loading activity</span>
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {history.data?.items.length === 0 && (
          <div className="empty-state">
            <h3>No lending activity yet</h3>
            <p>Recorded requests, decisions and borrowing operations will appear here.</p>
          </div>
        )}
        {history.data?.items
          .slice()
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .slice(0, 5)
          .map((event, index) => (
            <article key={event.targetId + event.occurredAt + index}>
              <div>
                <strong>{event.action.replaceAll('_', ' ')}</strong>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </div>
              <details>
                <summary>Record reference</summary>
                {event.targetId}
              </details>
            </article>
          ))}
      </section>
    </div>
  );
}
