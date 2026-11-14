'use client';
import { OfficerWorkspace } from '@/components/technical-officer/workspace';
import { LecturerWorkspace } from '@/components/lecturer/workspace';
import { StudentGuidance } from './student-guidance';
import { StudentBorrowed, StudentHistory } from './student-borrowed';
import { isStudent } from './student-model';
import { StudentMetrics } from './student-workspace';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ReviewPanel, ReviewWorkspace } from '@/components/ui/review-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/module-tabs';
import { Card } from '@/components/ui/card';
import { useState, type ReactNode } from 'react';
import { Authenticated, ErrorNotice } from '@/components/identity/session';
import { ActionForm, Field, useLending, useLendingChoices } from './shared';
import { RequestBuilder } from './request-builder';
import { Requests } from './request-workspace';
import { LendingMetrics } from './metrics';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item } from '@/components/inventory/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import type { Session } from '@/components/identity/api';
import type { Page, Policy, Allocation, Loan, HistoryEvent } from './api';
const sections = [
  'requests',
  'new',
  'approvals',
  'collection',
  'loans',
  'returns',
  'history',
  'policies',
] as const;
type Section = (typeof sections)[number];
const labels: Record<Section, string> = {
  requests: 'My requests',
  new: 'New request',
  approvals: 'Approval inbox',
  collection: 'Ready for collection',
  loans: 'Borrowed Equipment',
  returns: 'Returns',
  history: 'Borrowing History',
  policies: 'Item policies',
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not applicable';
const selectClass = 'min-h-11 border rounded-md bg-white px-3 w-full';
export function LendingWorkflow({ initialView = 'requests' }: { initialView?: string }) {
  return (
    <Authenticated>
      {(session) =>
        session.user.roles.includes('TECHNICAL_OFFICER') && initialView !== 'approvals' ? (
          <OfficerWorkspace
            key={initialView}
            session={session}
            view={
              (
                {
                  collection: 'handovers',
                  returns: 'returns',
                  loans: 'borrowed',
                  history: 'activity',
                  new: 'new',
                } as Record<string, string>
              )[initialView] ?? 'requests'
            }
          />
        ) : session.user.roles.includes('LECTURER') ? (
          <LecturerWorkspace
            key={initialView}
            session={session}
            view={
              (({ loans: 'borrowed' } as Record<string, string>)[initialView] ?? initialView) as
                'requests' | 'borrowed' | 'approvals' | 'policies' | 'new'
            }
          />
        ) : (
          <Workflow key={initialView} session={session} initialView={initialView} />
        )
      }
    </Authenticated>
  );
}
function Workflow({ session, initialView }: { session: Session; initialView: string }) {
  const router = useRouter();
  const student = isStudent(session.user.roles);
  const [view, setView] = useState<Section>(
    sections.includes(initialView as Section) &&
      (!student || ['requests', 'new', 'loans', 'history', 'policies'].includes(initialView))
      ? (initialView as Section)
      : 'requests'
  );
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const refresh = () => setRevision((x) => x + 1);
  const saved = () => {
    setNotice('Server recorded the operation. Current records have been refreshed.');
    refresh();
  };
  const roles = session.user.roles;
  const technical = roles.includes('TECHNICAL_OFFICER');
  const academic = roles.includes('LECTURER') || roles.includes('ADMIN');
  if (student && view === 'policies') return <StudentGuidance />;
  if (student && view === 'new')
    return (
      <div className="student-page student-request-page">
        <PageHeader
          eyebrow="Student workspace"
          title="New Borrowing Request"
          description="Select equipment, complete the academic purpose and schedule, then review your saved draft."
          actions={
            <Button asChild variant="outline">
              <Link href="/inventory">Browse Equipment</Link>
            </Button>
          }
        />
        <RequestBuilder session={session} revision={revision} refresh={saved} />
      </div>
    );
  return (
    <>
      <PageHeader
        eyebrow={student ? 'Student workspace' : 'Lending operations'}
        title={
          student
            ? view === 'new'
              ? 'New borrowing request'
              : 'My Requests & Borrowed Equipment'
            : 'Borrowing & Borrowed Equipment'
        }
        description={
          student
            ? 'Track your requests, collection readiness and borrowed equipment.'
            : 'Manage requests, approvals and equipment handovers in one place.'
        }
        actions={
          <Button asChild variant="outline">
            <Link href={student ? '/borrowing?view=new' : '/inventory'}>
              {student ? 'New borrowing request' : 'Browse inventory'}
            </Link>
          </Button>
        }
      />
      {student && <StudentMetrics session={session} revision={revision} />}
      <Tabs
        value={view}
        onValueChange={(value) => {
          if (student) router.push(`/borrowing?view=${value}`);
          else setView(value as Section);
        }}
        label="Lending sections"
        items={sections
          .filter(
            (x) =>
              !(student && x === 'new') &&
              !(['collection', 'returns'].includes(x) && !technical) &&
              !(x === 'approvals' && !academic)
          )
          .map((value) => ({ value, label: labels[value] }))}
        action={
          <Button variant="outline" onClick={refresh}>
            Refresh records
          </Button>
        }
      >
        {view === 'requests' && <LendingMetrics session={session} revision={revision} />}
        {notice && <p role="status">{notice}</p>}
        {view === 'new' ? (
          <RequestBuilder session={session} revision={revision} refresh={saved} />
        ) : view === 'requests' || view === 'approvals' ? (
          <Requests
            key={view}
            approvals={view === 'approvals'}
            session={session}
            revision={revision}
            refresh={saved}
          />
        ) : view === 'collection' ? (
          <Collection session={session} revision={revision} refresh={saved} />
        ) : view === 'loans' && student ? (
          <StudentBorrowed session={session} revision={revision} refresh={saved} />
        ) : view === 'loans' || view === 'returns' ? (
          <Loans
            key={view + revision}
            returns={view === 'returns'}
            session={session}
            revision={revision}
            refresh={saved}
          />
        ) : view === 'policies' ? (
          <Policies session={session} revision={revision} refresh={saved} />
        ) : student ? (
          <StudentHistory revision={revision} />
        ) : (
          <History revision={revision} />
        )}
      </Tabs>
    </>
  );
}
function Grid<T>({
  title,
  result,
  columns,
  rows,
  render,
}: {
  title: string;
  result: { data?: Page<T>; error?: string };
  columns: string[];
  rows?: T[];
  render: (row: T, index: number) => ReactNode[];
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const all = rows ?? result.data?.items ?? [];
  const filtered = all.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase())
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return (
    <Card className="record-grid">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <label className="record-search">
        Search current records
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Item, borrower, reference or status"
        />
      </label>
      {result.error && <ErrorNotice message={result.error} />}{' '}
      {!result.data && !result.error && (
        <div className="loading-rows" role="status">
          <span className="sr-only">Loading records</span>
          {[1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}
      {result.data && (
        <>
          <div
            className="table-region"
            role="region"
            aria-label={title + '; horizontal scrolling available'}
            tabIndex={0}
          >
            <Table>
              <TableCaption>{filtered.length} authorized matching records</TableCaption>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead scope="col" key={c}>
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice((current - 1) * 10, current * 10).map((row, i) => (
                  <TableRow key={i}>
                    {render(row, i).map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!filtered.length && <p role="status">No records in this scope match the filter.</p>}
          <div className="pagination">
            <Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span role="status">
              Page {current} of {pages}
            </span>
            <Button
              variant="outline"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
function Collection({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const requests = useLendingChoices<import('./api').BorrowRequest>('requests', revision);
  const result = useLending<Page<Allocation>>('allocations', revision);
  const catalogue = useInventoryLookup<Item>('items', revision);
  const [selected, setSelected] = useState<Allocation | null>(null);
  const currentLine = (row: Allocation) =>
    requests.data?.items.flatMap((request) => request.lines).find((line) => line.id === row.lineId);
  const remaining = (row: Allocation) => currentLine(row)?.reservedQuantity ?? 0;
  return (
    <ReviewWorkspace>
      <Grid
        title="Ready for collection"
        result={result}
        columns={['Item', 'Borrower', 'Reserved', 'Handed over', 'Remaining', 'Action']}
        render={(row) => [
          row.item,
          row.borrower,
          row.quantity,
          row.issued,
          remaining(row),
          <Button
            key="issue"
            disabled={
              remaining(row) < 1 ||
              row.borrowerId === session.user.id ||
              !catalogue.data ||
              !requests.data?.items.some((request) =>
                request.lines.some((line) => line.id === row.lineId)
              )
            }
            variant="outline"
            onClick={() => setSelected(row)}
          >
            Review handover
          </Button>,
        ]}
      />
      {selected && (
        <ReviewPanel
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title="Confirm physical handover"
          description="Check the borrower and quantity before handing over equipment."
        >
          <ActionForm
            key={selected.id}
            title="Confirm physical handover"
            path="issues"
            session={session}
            onSaved={() => {
              setSelected(null);
              refresh();
            }}
            body={(d) => ({
              allocationId: selected.id,
              expectedVersion: requests.data?.items
                .flatMap((request) => request.lines)
                .find((line) => line.id === selected.lineId)?.version,
              quantity: Number(d.get('quantity')),
              serial: String(d.get('serial') || '') || undefined,
            })}
          >
            <p>
              {selected.item} to {selected.borrower}; {remaining(selected)} reserved and unissued.
              Returnable equipment is handed over one unit at a time.
            </p>
            <label>
              Quantity handed over
              <Input
                name="quantity"
                type="number"
                min={1}
                max={
                  catalogue.data?.items.find((i) => i.id === selected.itemId)?.kind === 'CONSUMABLE'
                    ? remaining(selected)
                    : 1
                }
                defaultValue={1}
                required
              />
            </label>
            <Field
              name="serial"
              label="Manufacturer serial (optional for returnable equipment)"
              required={false}
            />
          </ActionForm>
        </ReviewPanel>
      )}
    </ReviewWorkspace>
  );
}
function Loans({
  returns,
  session,
  revision,
  refresh,
}: {
  returns: boolean;
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const result = useLending<Page<Loan>>('loans', revision);
  const [filter, setFilter] = useState('outstanding');
  const [selected, setSelected] = useState<Loan | null>(null);
  const [checkedAt] = useState(() => Date.now());
  const overdue = (row: Loan) =>
    row.status === 'overdue' ||
    (row.returned < row.quantity &&
      Boolean(row.dueAt && new Date(row.dueAt).getTime() < checkedAt));
  const rows = result.data?.items.filter((row) =>
    filter === 'all' || filter === 'overdue'
      ? filter === 'all' || overdue(row)
      : filter === 'returned'
        ? row.returned >= row.quantity
        : row.returned < row.quantity
  );
  return (
    <ReviewWorkspace>
      <label className="block my-3">
        Borrowing status
        <select className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="outstanding">Outstanding</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
          <option value="all">All</option>
        </select>
      </label>
      <Grid
        title={returns ? 'Receive equipment returns' : 'Borrowed Equipment'}
        result={result}
        rows={rows}
        columns={[
          'Item / asset',
          'Borrower',
          'Expected Return Date',
          'Outstanding',
          'Status',
          'Action',
        ]}
        render={(row) => [
          <span key="asset">
            {row.item}
            <details>
              <summary>Asset reference</summary>
              {row.assetId}
            </details>
          </span>,
          row.borrower,
          date(row.dueAt),
          row.quantity - row.returned,
          row.returned >= row.quantity
            ? 'Received into inspection'
            : overdue(row)
              ? 'Overdue'
              : 'Equipment Held by Borrower',
          returns && row.returned < row.quantity ? (
            <Button
              key="return"
              variant="outline"
              disabled={row.borrowerId === session.user.id}
              onClick={() => setSelected(row)}
            >
              Review return
            </Button>
          ) : (
            <details>
              <summary>Borrowing reference</summary>
              {row.id}
            </details>
          ),
        ]}
      />
      {selected && (
        <ReviewPanel
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title="Confirm equipment receipt"
          description="Review the equipment and record its condition on receipt."
        >
          <ActionForm
            key={selected.id}
            title="Confirm equipment receipt"
            path="returns"
            session={session}
            onSaved={() => {
              setSelected(null);
              refresh();
            }}
            body={(d) => ({
              loanId: selected.id,
              condition: d.get('condition'),
            })}
          >
            <p>
              {selected.item} / {selected.assetId} from {selected.borrower}. Receipt moves returned
              equipment into inspection. Use inventory stock operations for subsequent inspection
              clearance.
            </p>
            <Field name="condition" label="Condition on physical receipt" />
          </ActionForm>
        </ReviewPanel>
      )}
    </ReviewWorkspace>
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
  const result = useLending<Page<Policy>>('policies', revision);
  const [selected, setSelected] = useState<Policy | null>(null);
  const admin = session.user.roles.includes('ADMIN');
  return (
    <ReviewWorkspace>
      <Grid
        title="Item approval policies"
        result={result}
        columns={['Item', 'Approval requirement', 'Action']}
        render={(row) => [
          row.name,
          row.policy,
          admin ? (
            <Button key="policy" variant="outline" onClick={() => setSelected(row)}>
              Configure {row.name}
            </Button>
          ) : (
            'Read only'
          ),
        ]}
      />
      {admin && selected && (
        <ReviewPanel
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title="Configure approval policy"
          description="Review the approval route for this catalogue item."
        >
          <ActionForm
            key={selected.itemId}
            title="Save item approval policy"
            path="policies"
            session={session}
            onSaved={() => {
              setSelected(null);
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
            <p>
              {selected.name}. HOD stages assign {session.user.displayName} as the academic
              approver. Review this assignment before saving.
            </p>
            <label>
              Approval requirement
              <select
                name="policy"
                className={selectClass}
                defaultValue={selected.policy === 'UNCONFIGURED' ? 'NONE' : selected.policy}
              >
                {['NONE', 'LECTURER', 'HOD', 'BOTH'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </ActionForm>
        </ReviewPanel>
      )}
    </ReviewWorkspace>
  );
}
function History({ revision }: { revision: number }) {
  const result = useLending<Page<HistoryEvent>>('history', revision);
  return (
    <Grid
      title="Authorized lending history"
      result={result}
      columns={['When', 'Action', 'Record reference']}
      rows={result.data?.items.filter((row) => !['LOGIN', 'LOGOUT'].includes(row.action))}
      render={(row) => [
        date(row.occurredAt),
        row.action.replaceAll('_', ' '),
        <details key="reference">
          <summary>Record reference</summary>
          {row.targetId}
        </details>,
      ]}
    />
  );
}
