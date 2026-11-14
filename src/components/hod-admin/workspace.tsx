'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, Boxes, ClipboardCheck, PackageCheck, ShieldCheck } from 'lucide-react';
import type { Session, Resource } from '@/components/identity/api';
import { api } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { AdminResourceWorkspace } from '@/components/identity/admin-management';
import { CatalogueWorkspace } from '@/components/inventory/catalogue-workspace';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item } from '@/components/inventory/api';
import { Requests } from '@/components/lending/request-workspace';
import { RequestBuilder } from '@/components/lending/request-builder';
import { StudentBorrowed, StudentHistory } from '@/components/lending/student-borrowed';
import { useLendingChoices, ActionForm } from '@/components/lending/shared';
import type { BorrowRequest, HistoryEvent, Loan, Policy } from '@/components/lending/api';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReviewSheet } from '@/components/ui/review-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminHref, adminLabels, type AdminView } from './model';
import { ReportFilters } from './report-filters';
import { formatReportValue } from './report-format';

type ReportName = 'borrowing' | 'overdue' | 'inventory' | 'approvals' | 'audit';
type ReportResponse = {
  report: string;
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  metrics: Record<string, number>;
};
const date = (value: unknown) =>
  typeof value === 'string' && value ? new Date(value).toLocaleString('en-GB') : '—';
const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value).replaceAll('_', ' ');

export function AdminWorkspace({
  session,
  view = 'overview',
}: {
  session: Session;
  view?: AdminView;
}) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((r) => r + 1);
  if (!session.user.roles.includes('ADMIN'))
    return <ErrorNotice message="This workspace requires HOD/Administrator authority." />;
  if ((['users', 'batches', 'laboratories'] as AdminView[]).includes(view))
    return (
      <div className="admin-page">
        <AdminSectionNav active={view} section="administration" />
        <AdminResourceWorkspace resource={view as Resource} session={session} />
      </div>
    );
  if (view === 'inventory')
    return (
      <div className="admin-page">
        <AdminSectionNav active={view} section="inventory" />
        <CatalogueWorkspace session={session} oversight />
      </div>
    );
  if (view === 'approvals')
    return (
      <AdminPage
        title={adminLabels.approvals}
        eyebrow="Item-level decisions"
        description="Review only HOD-stage item lines currently assigned to you; self-approval remains prohibited."
        refresh={refresh}
      >
        <Requests approvals session={session} revision={revision} refresh={refresh} />
      </AdminPage>
    );
  if (view === 'adjustments')
    return (
      <div className="admin-page">
        <AdminSectionNav active={view} section="inventory" />
        <p className="admin-note">Stock adjustment proposers cannot approve their own proposals; current authority and balances are revalidated when approving.</p>
        <CatalogueWorkspace session={session} oversight initialTab="stock operations" />
      </div>
    );
  if (view === 'policies')
    return <div className="admin-page"><AdminSectionNav active={view} section="administration" /><Policies session={session} revision={revision} refresh={refresh} /></div>;
  if (view === 'audit') return <Audit />;
  if (view === 'borrowing')
    return <MyBorrowing session={session} revision={revision} refresh={refresh} />;
  if (view === 'reports') return <Reports />;
  return <Overview session={session} revision={revision} />;
}


function AdminSectionNav({ active, section }: {
  active: AdminView;
  section: 'administration' | 'inventory';
}) {
  const views: AdminView[] = section === 'inventory'
    ? ['inventory', 'adjustments']
    : ['users', 'batches', 'laboratories', 'policies'];
  return (
    <nav className="admin-context-nav" aria-label={section === 'inventory' ? 'Inventory oversight sections' : 'Administration sections'}>
      {views.map((view) => (
        <Button key={view} asChild size="sm" variant={active === view ? 'default' : 'ghost'}>
          <Link href={adminHref(view)} aria-current={active === view ? 'page' : undefined}>
            {adminLabels[view]}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

function AdminPage({
  title,
  eyebrow,
  description,
  refresh,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  refresh?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          refresh ? (
            <Button variant="outline" onClick={refresh}>
              Refresh records
            </Button>
          ) : undefined
        }
      />
      {children}
    </div>
  );
}

function Overview({ session, revision }: { session: Session; revision: number }) {
  const requests = useLendingChoices<BorrowRequest>('requests', revision);
  // Department-wide figures come from authorized reporting, not personal borrower history.
  const [department, setDepartment] = useState<{
    current: number;
    overdue: number;
    overdueRows: Array<Record<string, unknown>>;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<ReportResponse>('/api/admin/reports?report=borrowing&kind=RETURNABLE&status=BORROWED&limit=1', { signal: controller.signal }),
      api<ReportResponse>('/api/admin/reports?report=overdue&kind=RETURNABLE&limit=5', { signal: controller.signal }),
    ]).then(([current, overdue]) => {
      if (!controller.signal.aborted)
        setDepartment({ current: current.total + overdue.total, overdue: overdue.total, overdueRows: overdue.items });
    }).catch((error) => {
      if (!controller.signal.aborted)
        setDepartment({ current: 0, overdue: 0, overdueRows: [], error: error instanceof Error ? error.message : 'Department metrics unavailable.' });
    });
    return () => controller.abort();
  }, [revision]);
  const history = useLendingChoices<HistoryEvent>('history', revision);
  const inspections = useLendingChoices<Loan>('inspections', revision);
  const items = useInventoryLookup<Item>('items', revision);
  const assigned =
    requests.data?.items.flatMap((request) =>
      request.borrowerId === session.user.id
        ? []
        : request.lines
            .filter((line) => line.stage === 'HOD' && line.hodId === session.user.id)
            .map((line) => ({ request, line }))
    ) ?? [];
  const metrics = [
    ['Borrowed returnable records', department?.error ? '—' : department?.current ?? '—', PackageCheck],
    ['Overdue borrowing records', department?.error ? '—' : department?.overdue ?? '—', BarChart3],
    ['Awaiting HOD decisions', assigned.length, ClipboardCheck],
    ['Awaiting inspection', inspections.data?.items.length ?? 0, ShieldCheck],
  ] as const;
  const operations = (history.data?.items ?? [])
    .filter((event) => event.action.startsWith('LENDING_') || event.action.startsWith('INVENTORY_'))
    .slice(0, 6);
  return (
    <AdminPage
      title={adminLabels.overview}
      eyebrow="Department oversight"
      description={`Welcome, ${session.user.displayName}. Review departmental lending, inventory state and work requiring independent action.`}
    >
      {[requests.error, department?.error, history.error, inspections.error, items.error]
        .filter(Boolean)
        .map((e, i) => (
          <ErrorNotice key={i} message={e!} />
        ))}
      <div className="admin-metrics">
        {metrics.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Current authorized department scope</small>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="admin-overview-grid">
        <Card>
          <CardHeader>
            <CardTitle>Prioritized work queue</CardTitle>
            <CardDescription>Actions assigned to your identity.</CardDescription>
          </CardHeader>
          <CardContent className="admin-queue">
            {assigned.slice(0, 5).map(({ request, line }) => (
              <Link href={adminHref('approvals')} key={line.id}>
                <span>
                  <strong>{request.borrower}</strong>
                  <small>
                    {line.item} · {request.purpose}
                  </small>
                </span>
                <Badge variant="secondary">HOD review</Badge>
              </Link>
            ))}
            {requests.data && !assigned.length && (
              <Empty
                title="No HOD decisions waiting"
                detail="Assigned HOD-stage item lines will appear here."
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Returnable stock state</CardTitle>
            <CardDescription>
              Separate balances; consumables are not added to these counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="admin-stock-summary">
            {['available', 'reserved', 'borrowed', 'inspection', 'maintenance'].map((key) => (
              <div key={key}>
                <strong>
                  {items.data?.items
                    .filter((i) => i.kind === 'RETURNABLE')
                    .reduce((n, i) => n + (Number(i[key as keyof Item]) || 0), 0) ?? '—'}
                </strong>
                <span>{key}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue borrowing</CardTitle>
            <CardDescription>Current records requiring follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="admin-queue">
            {department?.overdueRows.map((loan) => (
              <Link href={adminHref('reports')} key={String(loan.id)}>
                <span>
                  <strong>{String(loan.item ?? 'Equipment')}</strong>
                  <small>
                    {String(loan.borrower ?? 'Borrower')} · due {date(loan.dueAt)}
                  </small>
                </span>
                <Badge variant="destructive">Overdue</Badge>
              </Link>
            ))}
            {department && !department.error && !department.overdue && (
              <Empty
                title="No overdue records"
                detail="No outstanding record in this scope is past its due date."
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent operational activity</CardTitle>
            <CardDescription>Identity and security events are excluded.</CardDescription>
          </CardHeader>
          <CardContent className="admin-activity">
            {operations.map((event) => (
              <article key={event.targetId + event.occurredAt}>
                <span>
                  <strong>{text(event.action)}</strong>
                  <small>{event.targetId}</small>
                </span>
                <time>{date(event.occurredAt)}</time>
              </article>
            ))}
            {history.data && !operations.length && (
              <Empty
                title="No operational activity"
                detail="Lending and inventory events will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

function Reports({ audit = false }: { audit?: boolean }) {
  const [report, setReport] = useState<ReportName>(audit ? 'audit' : 'borrowing');
  const [scope, setScope] = useState('operations');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<{ key: string; data?: ReportResponse; error?: string }>();
  const [exportError, setExportError] = useState('');
  const path = useMemo(
    () =>
      `/api/admin/reports?${new URLSearchParams({ report, ...(report === 'audit' ? { scope } : {}), limit: '20', offset: String(offset), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }).toString()}`,
    [report, scope, offset, filters]
  );
  useEffect(() => {
    const c = new AbortController();
    api<ReportResponse>(path, { signal: c.signal })
      .then((data) => {
        if (!c.signal.aborted) setState({ key: path, data });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({ key: path, error: e instanceof Error ? e.message : 'Unable to load report.' });
      });
    return () => c.abort();
  }, [path]);
  const current = state?.key === path ? state : undefined;
  const result = current?.data;
  const error = current?.error;
  async function exportReport(format: 'csv' | 'xlsx') {
    setExportError('');
    try {
      const response = await fetch(path + `&format=${format}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Authorized export could not be generated.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.');
    }
  }
  const columns = Array.from(
    new Set((result?.items ?? []).flatMap((item) => Object.keys(item)))
  ).slice(0, 8);
  const reportTabs: ReportName[] = audit
    ? ['audit']
    : ['borrowing', 'overdue', 'inventory', 'approvals'];
  return (
    <AdminPage
      title={audit ? adminLabels.audit : adminLabels.reports}
      eyebrow={audit ? 'Governance records' : 'Department reporting'}
      description={
        audit
          ? 'Review operational records separately from identity and security events.'
          : 'Permission-scoped department reports with server-side filtering, totals and exports.'
      }
    >
      <Card className="admin-report-card">
        <CardHeader>
          <div className="admin-report-tabs">
            {reportTabs.map((name) => (
              <Button
                key={name}
                variant={report === name ? 'default' : 'ghost'}
                onClick={() => {
                  setReport(name);
                  setFilters({});
                  setOffset(0);
                }}
              >
                {text(name)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {audit && (
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                aria-label="Audit scope"
              >
                <option value="operations">Operations & Inventory</option>
                <option value="security">Identity & Security</option>
              </select>
            )}
            <Button variant="outline" onClick={() => void exportReport('csv')}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => void exportReport('xlsx')}>
              Export XLSX
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ReportFilters
            filters={filters}
            setFilters={(next) => {
              setFilters(next);
              setOffset(0);
            }}
            audit={audit}
            report={report}
            key={report}
          />
          {(error || exportError) && <ErrorNotice message={error ?? exportError} />}{' '}
          {!current && !error ? (
            <div className="p-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : result?.items.length ? (
            <div className="table-region">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c}>{text(c)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((row, i) => (
                    <TableRow key={String(row.id ?? i)}>
                      {columns.map((c) => (
                        <TableCell key={c}>
                          {formatReportValue(c, row[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty
              title="No report records"
              detail="No authorized records match the current server-side filters."
            />
          )}
          <div className="admin-pagination">
            <span>{result?.total ?? 0} total records</span>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Previous
            </Button>
            <span>Page {offset / 20 + 1}</span>
            <Button
              variant="outline"
              disabled={!result || result.items.length < 20}
              onClick={() => setOffset(offset + 20)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function Policies({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const policies = useLendingChoices<Policy>('policies', revision);
  const [selected, setSelected] = useState<Policy>();
  return (
    <AdminPage
      title={adminLabels.policies}
      eyebrow="Item-level governance"
      description="Configure explicit None, Lecturer, HOD, or Lecturer followed by HOD approval routes. Unconfigured remains distinct and fails closed."
      refresh={refresh}
    >
      <Card>
        <CardContent className="p-0">
          {policies.error && <ErrorNotice message={policies.error} />}{' '}
          {!policies.data && !policies.error ? (
            <Skeleton className="h-24 m-4" />
          ) : policies.data?.items.length ? (
            <div className="table-region">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Approval requirement</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.data.items.map((policy) => (
                    <TableRow key={policy.itemId}>
                      <TableCell>{policy.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={policy.policy === 'UNCONFIGURED' ? 'destructive' : 'secondary'}
                        >
                          {text(policy.policy)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" onClick={() => setSelected(policy)}>
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty
              title="No policy records"
              detail="Catalogue items will appear here when visible in your authorized scope."
            />
          )}
        </CardContent>
      </Card>
      <ReviewSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title="Configure approval policy"
        description="Existing submitted requests retain their frozen policy snapshot."
      >
        {selected && (
          <ActionForm
            title="Save item approval policy"
            path="policies"
            session={session}
            onSaved={() => {
              setSelected(undefined);
              refresh();
            }}
            body={(d) => ({
              itemId: selected.itemId,
              policy: d.get('policy'),
              ...(['HOD', 'BOTH'].includes(String(d.get('policy')))
                ? { hodId: session.user.id }
                : {}),
            })}
          >
            <p>{selected.name}. No self-approval exception is created by this setting.</p>
            <label>
              Approval route
              <select
                name="policy"
                defaultValue={selected.policy === 'UNCONFIGURED' ? '' : selected.policy}
                required
              >
                <option value="" disabled>
                  Choose explicit policy
                </option>
                <option value="NONE">None</option>
                <option value="LECTURER">Lecturer</option>
                <option value="HOD">HOD</option>
                <option value="BOTH">Lecturer followed by HOD</option>
              </select>
            </label>
          </ActionForm>
        )}
      </ReviewSheet>
    </AdminPage>
  );
}

function Audit() {
  return <Reports audit />;
}

function MyBorrowing({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  return (
    <AdminPage
      title={adminLabels.borrowing}
      eyebrow="Personal borrowing"
      description="Borrow under the same item policies as every other user; administrator authority never bypasses approval or handover conflicts."
      refresh={refresh}
    >
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="borrowed">Borrowed Equipment</TabsTrigger>
          <TabsTrigger value="new">New Request</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Requests approvals={false} session={session} revision={revision} refresh={refresh} />
        </TabsContent>
        <TabsContent value="borrowed">
          <StudentBorrowed session={session} revision={revision} refresh={refresh} />
          <StudentHistory revision={revision} />
        </TabsContent>
        <TabsContent value="new">
          <RequestBuilder session={session} revision={revision} refresh={refresh} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="admin-empty" role="status">
      <Boxes size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
