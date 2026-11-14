'use client';
import { StudentEmptyState } from './student-empty-state';
import { StudentReminders, StudentQuickActions } from './student-guidance';
import { studentActivity } from './student-activity';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FileText, Clock, Package, Layers, TriangleAlert } from 'lucide-react';
import { useStudentClock } from './student-clock';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useLendingChoices } from './shared';
import type { BorrowDraft, BorrowRequest, Loan, HistoryEvent } from './api';
import { studentCounts, needsStudentAttention, isStudentOverdue } from './student-model';
const when = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : 'Not applicable';
function useStudentRecords(session: Session, revision: number) {
  const drafts = useLendingChoices<BorrowDraft>('drafts', revision);
  const requests = useLendingChoices<BorrowRequest>('requests', revision);
  const loans = useLendingChoices<Loan>('loans', revision);
  return {
    drafts,
    requests,
    loans,
    mine: requests.data?.items.filter((r) => r.borrowerId === session.user.id),
    held: loans.data?.items.filter((l) => l.borrowerId === session.user.id),
  };
}
export function StudentMetrics({ session, revision = 0 }: { session: Session; revision?: number }) {
  const { drafts, requests, loans, mine, held } = useStudentRecords(session, revision);
  const now = useStudentClock(loans.data);
  const counts =
    drafts.data && mine && held ? studentCounts(drafts.data.items, mine, held, now) : undefined;
  return (
    <>
      <div className="student-metrics" aria-label="Your borrowing overview">
        {['Draft', 'Pending approvals', 'Ready collection', 'Borrowed', 'Overdue'].map(
          (label, i) => {
            const Icon = [FileText, Clock, Package, Layers, TriangleAlert][i];
            return (
              <Card key={label}>
                <span className={`student-kpi-icon tone-${i}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <CardContent>
                  <CardDescription>{label}</CardDescription>
                  {counts ? (
                    <strong>{new Intl.NumberFormat().format(counts[i])}</strong>
                  ) : (
                    <Skeleton className="h-7 w-12 mt-2" />
                  )}
                </CardContent>
              </Card>
            );
          }
        )}
      </div>
      {[drafts.error, requests.error, loans.error].filter(Boolean).map((error, i) => (
        <ErrorNotice key={i} message={error!} />
      ))}
      {!counts && ![drafts.error, requests.error, loans.error].some(Boolean) && (
        <p role="status">Loading your borrowing overview...</p>
      )}
    </>
  );
}
export function StudentDashboard({ session }: { session: Session }) {
  const { drafts, requests, loans, mine, held } = useStudentRecords(session, 0);
  const history = useLendingChoices<HistoryEvent>('history', 0);
  const lifecycle = useLendingChoices<Loan>('borrower-history', 0);
  const now = useStudentClock(loans.data);
  const attention = mine?.filter(needsStudentAttention);
  const activity = history.data
    ? studentActivity(history.data.items, mine ?? [], lifecycle.data?.items ?? held ?? []).slice(
        0,
        5
      )
    : undefined;
  return (
    <div className="student-page">
      <PageHeader
        eyebrow="Student workspace"
        title="Student Dashboard"
        description={`Welcome back, ${session.user.displayName}. Here's your laboratory borrowing overview.`}
        actions={
          <Button asChild>
            <Link href="/borrowing?view=new">New borrowing request</Link>
          </Button>
        }
      />
      <StudentMetrics session={session} />
      <div className="student-dashboard-main">
        <StudentPanel
          title="Requests requiring attention"
          action={<Link href="/borrowing?view=requests">View all</Link>}
        >
          {requests.error && <ErrorNotice message={requests.error} />}
          {drafts.error && <ErrorNotice message={drafts.error} />}
          {!requests.data && !requests.error && <p role="status">Loading requests...</p>}
          {drafts.data?.items
            .filter((d) => !d.cancelled && !d.submittedId)
            .slice(0, 3)
            .map((d) => (
              <div className="student-attention" key={d.id}>
                <div>
                  <strong>{d.payload.purpose || 'Untitled draft'}</strong>
                  <p>Draft / {d.payload.lines.length} items</p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/borrowing?view=requests&group=drafts">Continue draft</Link>
                </Button>
              </div>
            ))}
          {attention?.slice(0, 4).map((r) => (
            <div className="student-attention" key={r.id}>
              <div>
                <strong>{r.purpose}</strong>
                <p>{r.summary.replaceAll('_', ' ')}</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/borrowing?view=requests">
                  {r.lines.some((line) => line.stage === 'REJECTED')
                    ? 'Review correction'
                    : 'View collection'}
                </Link>
              </Button>
            </div>
          ))}
          {requests.data &&
            drafts.data &&
            !attention?.length &&
            !drafts.data.items.some((d) => !d.cancelled && !d.submittedId) && (
              <StudentEmptyState kind="attention" />
            )}
        </StudentPanel>
        <StudentPanel
          title="Currently borrowed"
          action={<Link href="/borrowing?view=loans">View all</Link>}
        >
          {loans.error && <ErrorNotice message={loans.error} />}
          {held?.some((l) => l.returned < l.quantity) && (
            <div
              className="table-region"
              role="region"
              tabIndex={0}
              aria-label="Currently borrowed equipment; horizontal scrolling available"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Equipment', 'Qty', 'Expected return', 'Status'].map((x) => (
                      <TableHead key={x}>{x}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {held
                    ?.filter((l) => l.returned < l.quantity)
                    .slice(0, 5)
                    .map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.item}</TableCell>
                        <TableCell>{l.quantity - l.returned}</TableCell>
                        <TableCell>{when(l.dueAt)}</TableCell>
                        <TableCell>{isStudentOverdue(l, now) ? 'Overdue' : 'Borrowed'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
          {loans.data && !held?.some((l) => l.returned < l.quantity) && (
            <StudentEmptyState kind="borrowed" />
          )}
          {!loans.data && !loans.error && <p role="status">Loading borrowed equipment...</p>}
        </StudentPanel>
      </div>
      <div className="student-dashboard-bottom">
        <StudentPanel title="Recent borrowing activity">
          <ScrollArea className="student-activity-scroll">
            {history.error && <ErrorNotice message={history.error} />}
            {!history.data && !history.error && <p role="status">Loading activity...</p>}
            {activity?.map((e, i) => (
              <article className="student-event" key={e.key + i}>
                <div>
                  <strong>{e.reference}</strong>
                  <span className="student-activity-label">{e.label}</span>
                </div>
                <time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString()}</time>
              </article>
            ))}
            {activity?.length === 0 && <StudentEmptyState kind="activity" />}
          </ScrollArea>
        </StudentPanel>
        <StudentQuickActions />
        <StudentReminders />
      </div>
    </div>
  );
}

function StudentPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="student-card student-panel">
      <CardHeader>
        <div className="section-heading">
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="sr-only">{title}</CardFooter>
    </Card>
  );
}
