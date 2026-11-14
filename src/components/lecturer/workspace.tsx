'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Clock3, FileCheck2, PackageCheck, ClipboardList } from 'lucide-react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Requests } from '@/components/lending/request-workspace';
import { StudentBorrowed, StudentHistory } from '@/components/lending/student-borrowed';
import { RequestBuilder } from '@/components/lending/request-builder';
import { StudentBrowse } from '@/components/lending/student-browse';
import { useLendingChoices } from '@/components/lending/shared';
import type {
  Allocation,
  BorrowRequest,
  HistoryEvent,
  Loan,
  Policy,
} from '@/components/lending/api';
import { lecturerHref, type LecturerView } from './model';
import { LecturerEmpty } from './empty-state';

const date = (value: string) => new Date(value).toLocaleString('en-GB');
const lendingActivity = (event: HistoryEvent) =>
  !['LOGIN', 'LOGOUT'].includes(event.action) && event.action.startsWith('LENDING_');

export function LecturerWorkspace({
  session,
  view = 'dashboard',
}: {
  session: Session;
  view?: LecturerView | 'new';
}) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  if (!session.user.roles.includes('LECTURER'))
    return <ErrorNotice message="This workspace requires a Lecturer assignment." />;
  if (view === 'equipment') return <StudentBrowse session={session} />;
  if (view === 'new')
    return (
      <div className="lecturer-page">
        <PageHeader
          eyebrow="Lecturer workspace"
          title="New borrowing request"
          description="Create an item-specific request using current equipment sources and approval rules."
          actions={
            <Button asChild variant="outline">
              <Link href={lecturerHref('requests')}>Back to My Requests</Link>
            </Button>
          }
        />
        <RequestBuilder session={session} revision={revision} refresh={refresh} />
      </div>
    );
  if (view === 'requests')
    return (
      <LecturerPage
        title="My Requests"
        description="Track your submitted requests, item-level approval progress and collection readiness."
        refresh={refresh}
      >
        <Requests approvals={false} session={session} revision={revision} refresh={refresh} />
      </LecturerPage>
    );
  if (view === 'borrowed')
    return (
      <LecturerPage
        title="Borrowed Equipment"
        description="Review equipment currently issued to you, return dates, extensions and borrowing history."
        refresh={refresh}
      >
        <div className="lecturer-borrowing-grid">
          <StudentBorrowed session={session} revision={revision} refresh={refresh} />
          <StudentHistory revision={revision} />
        </div>
      </LecturerPage>
    );
  if (view === 'approvals')
    return (
      <LecturerPage
        title="Approval Inbox"
        description="Review only item lines currently assigned to you. Your own requests cannot be approved here."
        refresh={refresh}
      >
        <Requests approvals session={session} revision={revision} refresh={refresh} />
      </LecturerPage>
    );
  if (view === 'policies') return <Policies revision={revision} refresh={refresh} />;
  return <Dashboard session={session} revision={revision} refresh={refresh} />;
}

function LecturerPage({
  title,
  description,
  refresh,
  children,
}: {
  title: string;
  description: string;
  refresh: () => void;
  children: ReactNode;
}) {
  return (
    <div className="lecturer-page">
      <PageHeader
        eyebrow="Lecturer workspace"
        title={title}
        description={description}
        actions={
          <>
            <Button variant="outline" onClick={refresh}>
              Refresh records
            </Button>
            <Button asChild>
              <Link href="/borrowing?view=new">New borrowing request</Link>
            </Button>
          </>
        }
      />
      {children}
    </div>
  );
}

function Dashboard({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const requests = useLendingChoices<BorrowRequest>('requests', revision);
  const loans = useLendingChoices<Loan>('borrower-history', revision);
  const allocations = useLendingChoices<Allocation>('allocations', revision);
  const history = useLendingChoices<HistoryEvent>('history', revision);
  const mine =
    requests.data?.items.filter((request) => request.borrowerId === session.user.id) ?? [];
  const assigned =
    requests.data?.items.flatMap((request) =>
      request.borrowerId === session.user.id
        ? []
        : request.lines
            .filter((line) => line.stage === 'LECTURER' && line.lecturerId === session.user.id)
            .map((line) => ({ request, line }))
    ) ?? [];
  const borrowed =
    loans.data?.items.filter(
      (loan) => loan.borrowerId === session.user.id && loan.returned < loan.quantity
    ) ?? [];
  const ready =
    allocations.data?.items.filter(
      (row) => row.borrowerId === session.user.id && row.issued < row.quantity
    ) ?? [];
  const activity = (history.data?.items ?? [])
    .filter(lendingActivity)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);
  const loading = !requests.data || !loans.data || !allocations.data;
  const metrics = [
    [
      'Awaiting my decision',
      assigned.length,
      'Requests assigned to you for lecturer review.',
      FileCheck2,
    ],
    [
      'My submitted requests',
      mine.length,
      'Pending, approved and collection-ready requests.',
      ClipboardList,
    ],
    [
      'Currently borrowed',
      borrowed.length,
      'Equipment currently issued under your name.',
      PackageCheck,
    ],
    ['Ready for collection', ready.length, 'Reserved equipment awaiting collection.', Clock3],
  ] as const;
  return (
    <div className="lecturer-page">
      <PageHeader
        eyebrow="Operations overview"
        title="Lecturer workspace"
        description={`Welcome, ${session.user.displayName}. Review approvals, manage your own requests and track borrowed laboratory equipment.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={lecturerHref('approvals')}>Open approval inbox</Link>
            </Button>
            <Button asChild>
              <Link href="/borrowing?view=new">New borrowing request</Link>
            </Button>
          </>
        }
      />
      {[requests.error, loans.error, allocations.error, history.error]
        .filter(Boolean)
        .map((error, index) => (
          <ErrorNotice key={index} message={error!} />
        ))}
      <div className="lecturer-metrics">
        {metrics.map(([label, value, note, Icon]) => (
          <Card key={label}>
            <CardContent>
              <span className="lecturer-metric-icon">
                <Icon size={19} />
              </span>
              <CardDescription>{label}</CardDescription>
              {loading ? <Skeleton className="h-8 w-12 mt-2" /> : <strong>{value}</strong>}
              <small>{note}</small>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="lecturer-dashboard-grid">
        <DashboardCard
          title="Approvals requiring attention"
          description="Item lines assigned to your lecturer stage."
        >
          {assigned.slice(0, 5).map(({ request, line }) => (
            <Link href={lecturerHref('approvals')} key={line.id}>
              <span>
                <strong>{request.borrower}</strong>
                <small>
                  {line.item} · {request.purpose}
                </small>
              </span>
              <Badge variant="secondary">{line.stage}</Badge>
            </Link>
          ))}
          {requests.data && !assigned.length && <LecturerEmpty kind="approvals" />}
        </DashboardCard>
        <DashboardCard
          title="My current borrowing"
          description="Equipment currently issued under your identity."
        >
          {borrowed.slice(0, 5).map((loan) => (
            <Link href={lecturerHref('borrowed')} key={loan.id}>
              <span>
                <strong>{loan.item}</strong>
                <small>Expected return {loan.dueAt ? date(loan.dueAt) : 'not supplied'}</small>
              </span>
              <Badge variant="outline">{loan.quantity - loan.returned} held</Badge>
            </Link>
          ))}
          {loans.data && !borrowed.length && (
            <LecturerEmpty
              kind="borrowing"
              href={lecturerHref('equipment')}
              action="Browse equipment"
            />
          )}
        </DashboardCard>
        <DashboardCard title="My requests" description="Recent requests and collection readiness.">
          {mine.slice(0, 5).map((request) => (
            <Link href={lecturerHref('requests')} key={request.id}>
              <span>
                <strong>{request.purpose}</strong>
                <small>{request.lines.map((line) => line.item).join(', ')}</small>
              </span>
              <Badge variant="secondary">{request.summary.replaceAll('_', ' ')}</Badge>
            </Link>
          ))}
          {requests.data && !mine.length && (
            <LecturerEmpty
              kind="requests"
              href="/borrowing?view=new"
              action="New borrowing request"
            />
          )}
        </DashboardCard>
        <DashboardCard
          title="Recent borrowing activity"
          description="Security sign-in and sign-out events are excluded."
        >
          {activity.map((event) => (
            <article key={event.targetId + event.occurredAt}>
              <span>
                <strong>{event.action.replaceAll('LENDING_', '').replaceAll('_', ' ')}</strong>
                <small>{date(event.occurredAt)}</small>
              </span>
            </article>
          ))}
          {history.data && !activity.length && <LecturerEmpty kind="activity" />}
        </DashboardCard>
      </div>
      <Button variant="outline" onClick={refresh}>
        Refresh dashboard
      </Button>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="lecturer-list">{children}</CardContent>
    </Card>
  );
}

function Policies({ revision, refresh }: { revision: number; refresh: () => void }) {
  const policies = useLendingChoices<Policy>('policies', revision);
  return (
    <div className="lecturer-page">
      <PageHeader
        eyebrow="Borrowing guidance"
        title="Policies & Help"
        description="Approval rules, borrower responsibilities, equipment return workflow and comment handling for Lecturer borrowing and review work."
      />
      {policies.error && <ErrorNotice message={policies.error} />}
      <div className="lecturer-policy-grid">
        <Card>
          <CardHeader>
            <CardTitle>Approval reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="lecturer-guidance-list">
              <GuidanceItem title="Borrower selects the eligible lecturer">
                The server validates the selected lecturer against authorized lecturers and relevant
                laboratory assignments.
              </GuidanceItem>
              <GuidanceItem title="Item-specific policies apply">
                Different request lines can follow different approval paths. The interface preserves
                each item stage instead of collapsing the request into one misleading status.
              </GuidanceItem>
              <GuidanceItem title="No self-approval">
                Lecturers may create borrowing requests for themselves, but their own lines are
                excluded from their approval inbox.
              </GuidanceItem>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Return workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="lecturer-guidance-list">
              <GuidanceItem title="Return receipt is separate from inspection">
                Technical officers receive equipment first. Inspection clearance is a later,
                separate operation.
              </GuidanceItem>
              <GuidanceItem title="Comments are append-only">
                Corrections create new linked records rather than changing or removing the existing
                comment history.
              </GuidanceItem>
              <GuidanceItem title="Overdue equipment remains visible">
                Borrowers and authorized reviewers continue to see overdue states and due-date
                changes in borrowing history.
              </GuidanceItem>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="lecturer-policy-table">
        <CardHeader className="lecturer-policy-heading">
          <div>
            <CardTitle>Item approval policies</CardTitle>
            <CardDescription>
              Current server-authorized approval requirement by catalogue item.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={refresh}>
            Refresh policies
          </Button>
        </CardHeader>
        <CardContent>
          {!policies.data && !policies.error ? (
            <Skeleton className="h-24 w-full" />
          ) : policies.data?.items.length ? (
            <div className="table-region">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Approval requirement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.data?.items.map((policy) => (
                    <TableRow key={policy.itemId}>
                      <TableCell>
                        <strong>{policy.name}</strong>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{policy.policy.replaceAll('_', ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <LecturerEmpty
              kind="policies"
              href={lecturerHref('equipment')}
              action="Browse equipment"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GuidanceItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
