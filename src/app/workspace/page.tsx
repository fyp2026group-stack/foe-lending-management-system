'use client';
import { OfficerWorkspace } from '@/components/technical-officer/workspace';
import { LecturerWorkspace } from '@/components/lecturer/workspace';
import { AdminWorkspace } from '@/components/hod-admin/workspace';
import { StudentDashboard } from '@/components/lending/student-workspace';
import { isStudent } from '@/components/lending/student-model';
import { Authenticated } from '@/components/identity/session';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LendingMetrics } from '@/components/lending/metrics';
import { WorkspaceSummary } from '@/components/lending/workspace-summary';

const actions = [
  {
    href: '/inventory',
    title: 'Inventory catalogue',
    description: 'Search equipment, inspect stock state and manage authorized inventory records.',
    label: 'Open inventory',
  },
  {
    href: '/borrowing?view=new',
    title: 'New borrowing request',
    description: 'Choose available items and submit a multi-item request for approval.',
    label: 'Create request',
  },
  {
    href: '/borrowing?view=requests',
    title: 'Request tracking',
    description: 'Review approval stages, remarks and collection readiness.',
    label: 'View requests',
  },
  {
    href: '/borrowing?view=loans',
    title: 'Loans & overdue',
    description: 'Monitor active custody, due dates and outstanding equipment.',
    label: 'View loans',
  },
];
export default function WorkspacePage() {
  return (
    <Authenticated>
      {(session) =>
        session.user.roles.includes('ADMIN') ? (
          <AdminWorkspace session={session} />
        ) : session.user.roles.includes('TECHNICAL_OFFICER') ? (
          <OfficerWorkspace session={session} />
        ) : isStudent(session.user.roles) ? (
          <StudentDashboard session={session} />
        ) : session.user.roles.includes('LECTURER') ? (
          <LecturerWorkspace session={session} />
        ) : (
          <>
            <PageHeader
              eyebrow="Operations overview"
              title="Laboratory workspace"
              description={`Welcome, ${session.user.displayName}. Manage today's laboratory work from here.`}
              actions={
                <Button asChild>
                  <Link href="/borrowing?view=new">New borrowing request</Link>
                </Button>
              }
            />
            <LendingMetrics session={session} />
            <WorkspaceSummary session={session} />
            <Card className="dashboard-section">
              <CardHeader>
                <CardTitle>Daily operations</CardTitle>
                <span className="muted">Choose a task to continue</span>
              </CardHeader>
              <CardContent className="operation-grid">
                {actions.map((action, index) => (
                  <Link className="task-entry" href={action.href} key={action.href}>
                    <span className="task-number" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <div>
                      <h3>{action.title}</h3>
                      <p>{action.description}</p>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <div className="dashboard-columns">
              <section className="records dashboard-list">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">LENDING</p>
                    <h2>Workflow areas</h2>
                  </div>
                </div>
                <Link href="/borrowing?view=history">
                  <span>Complete lending history</span>
                  <small>Audit previous requests, issues and returns</small>
                </Link>
                <Link href="/borrowing?view=policies">
                  <span>Approval policies</span>
                  <small>Review item-level approval requirements</small>
                </Link>
                {(session.user.roles.includes('LECTURER') ||
                  session.user.roles.includes('ADMIN')) && (
                  <Link href="/borrowing?view=approvals">
                    <span>Approval queue</span>
                    <small>Review requests assigned to you</small>
                  </Link>
                )}
                {session.user.roles.includes('TECHNICAL_OFFICER') && (
                  <>
                    <Link href="/borrowing?view=collection">
                      <span>Ready for collection</span>
                      <small>Confirm authorized physical handovers</small>
                    </Link>
                    <Link href="/borrowing?view=returns">
                      <span>Equipment returns</span>
                      <small>Receive equipment into inspection</small>
                    </Link>
                  </>
                )}
              </section>
              {session.user.roles.includes('ADMIN') && (
                <section className="records dashboard-list">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">ADMINISTRATION</p>
                      <h2>System management</h2>
                    </div>
                  </div>
                  <Link href="/admin/users">
                    <span>User access</span>
                    <small>Manage roles and laboratory assignments</small>
                  </Link>
                  <Link href="/admin/batches">
                    <span>Academic batches</span>
                    <small>Maintain borrower cohort references</small>
                  </Link>
                  <Link href="/admin/laboratories">
                    <span>Laboratories</span>
                    <small>Maintain operational laboratory records</small>
                  </Link>
                </section>
              )}
            </div>
          </>
        )
      }
    </Authenticated>
  );
}
