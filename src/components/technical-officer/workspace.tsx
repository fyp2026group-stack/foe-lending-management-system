'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { OfficerEmpty } from './empty-state';
import { officerHasRows } from './empty-model';
import { useState, type ReactNode } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { PackageCheck, Undo2, ClipboardCheck, Boxes, Activity, ArrowRight, Plus, FileSpreadsheet, SlidersHorizontal } from 'lucide-react';

import type { Session } from '@/components/identity/api';

import { ErrorNotice } from '@/components/identity/session';

import { PageHeader } from '@/components/ui/page-header';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';

import { Field, FieldLabel } from '@/components/ui/field';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import { ReviewSheet } from '@/components/ui/review-sheet';

import { StudentDataTable, type StudentColumn } from '@/components/lending/student-data-table';

import { HandoverFacts } from '@/components/lending/handover-facts';
import { useStudentClock } from '@/components/lending/student-clock';
import { useLending, useLendingChoices, ActionForm } from '@/components/lending/shared';

import { Requests } from '@/components/lending/request-workspace';

import { RequestBuilder } from '@/components/lending/request-builder';

import { StudentBorrowed } from '@/components/lending/student-borrowed';

import type {
  Allocation,
  BorrowRequest,
  Loan,
  Policy,
  OperationsSummary,
} from '@/components/lending/api';

import { useInventoryLookup } from '@/components/inventory/lookups';

import { ImportPanel, ItemDetail, ReceiveItemsDialog } from '@/components/inventory/inventory';
import { OfficerStockActions } from '@/components/inventory/officer-stock-actions';

import type { Item, Named, Movement } from '@/components/inventory/api';

import {
  officerViews,
  officerLabels,
  officerHref,
  isDue,
  laboratoryName,
  handoverRemarks,
  operationsSummaryQuery,
  completedOperationsLabel,
  type OfficerView,
} from './model';

type Inspection = {
  id: string;
  version: number;
  status: string;
  receipt: { condition: string; created_at: string; actor_id: string };
  events: { id: string; actor_id: string; outcome: string; notes: string; created_at: string }[];
};

type Physical = Loan & { version: number; serial?: string; inspection?: Inspection };

const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString('en-GB') : 'Not supplied';

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="officer-metric">
      <span className="officer-metric-icon">
        <Boxes size={19} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value ?? '?'}</strong>
      </div>
    </div>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertTitle>Operational scope</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Records<T extends object>({
  title,
  records,
  columns,
  id,
  tools,
  filtered = false,
  onReset,
  description,
}: {
  description?: string;
  filtered?: boolean;
  onReset?: () => void;
  title: string;
  records: { data?: { items: T[] }; error?: string };
  columns: StudentColumn<T>[];
  id: (row: T) => string;
  tools?: ReactNode;
}) {
  return (
    <Card className="officer-records" data-panel={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="officer-panel-description">{description}</p>}
      </CardHeader>
      {tools && <div className="officer-toolbar">{tools}</div>}
      {records.error && <ErrorNotice message={records.error} />}
      {!records.data && !records.error && (
        <div role="status" className="loading-rows">
          <span className="sr-only">Loading authorized records</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {records.data &&
        (officerHasRows(records.data.items) ? (
          <StudentDataTable
            data={records.data.items}
            columns={columns}
            recordId={id}
            label={title}
          />
        ) : (
          <OfficerEmpty
            area={title}
            filtered={filtered}
            onReset={onReset}
            href={officerHref('inventory')}
            action="Browse inventory"
          />
        ))}
    </Card>
  );
}

export function OfficerWorkspace({
  session,
  view = 'dashboard',
}: {
  session: Session;
  view?: string;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((r) => r + 1);
  const [creating, setCreating] = useState(view === 'new');

  const current =
    view === 'new'
      ? 'requests'
      : officerViews.includes(view as OfficerView)
        ? (view as OfficerView)
        : 'dashboard';

  const destination =
    (
      {
        dashboard: 'stock',
        handovers: 'activity',
        returns: 'inspections',
        inspections: 'inventory',
        inventory: 'activity',
        stock: 'activity',
        imports: 'stock',
        borrowed: 'requests',
        activity: 'inventory',
      } as Partial<Record<OfficerView, OfficerView>>
    )[current] ?? 'requests';
  const actionLabel =
    (
      {
        dashboard: 'Record stock receipt',
        handovers: 'View handover history',
        returns: 'View inspection queue',
        inspections: 'Inventory status',
        inventory: 'View inventory history',
        stock: 'View stock movements',
        imports: 'Stock operations',
        borrowed: 'My Requests',
        activity: 'Inventory catalogue',
      } as Partial<Record<OfficerView, string>>
    )[current] ?? 'New borrowing request';
  if (!session.user.roles.includes('TECHNICAL_OFFICER'))
    return <Notice>This workspace requires a Technical Officer assignment.</Notice>;

  return (
    <div className={`officer-page officer-view-${current}`}>
      <PageHeader
        eyebrow="Equipment & inventory operations"
        title={current === 'dashboard' ? 'Technical officer workspace' : officerLabels[current]}
        description={
          current === 'dashboard'
            ? `Welcome, ${session.user.displayName}. Prioritise physical handovers, returns and inspection clearance.`
            : 'Current records and actions for your authorized laboratories.'
        }
        actions={
          <>
            <Button variant="outline" onClick={refresh}>
              Refresh records
            </Button>
            <>
              {current === 'requests' ? (
                <Button onClick={() => setCreating(!creating)}>
                  {creating ? 'View my requests' : 'New borrowing request'}
                </Button>
              ) : current !== 'inventory' && current !== 'imports' ? (
                <Button asChild>
                  <Link href={officerHref(destination)}>{actionLabel}</Link>
                </Button>
              ) : null}
            </>
          </>
        }
      />

      {current === 'dashboard' ? (
        <Dashboard session={session} revision={revision} />
      ) : current === 'handovers' ? (
        <Handovers session={session} revision={revision} refresh={refresh} />
      ) : current === 'returns' || current === 'inspections' ? (
        <PhysicalQueue
          key={current}
          inspections={current === 'inspections'}
          session={session}
          revision={revision}
          refresh={refresh}
        />
      ) : ['inventory', 'stock', 'imports', 'activity'].includes(current) ? (
        <Tabs value={current === 'imports' || current === 'stock' ? 'inventory' : current}
          onValueChange={(value) => router.push(officerHref(value as OfficerView))}>
          <TabsList variant="line" className="officer-section-tabs" aria-label="Inventory">
            <TabsTrigger value="inventory">Equipment</TabsTrigger>
            <TabsTrigger value="activity">Inventory history</TabsTrigger>
          </TabsList>
          <TabsContent value={current === 'imports' || current === 'stock' ? 'inventory' : current} className="pt-3">
            {current === 'activity'
              ? <OperationsActivity revision={revision} />
              : <InventoryArea view={current} session={session} revision={revision} refresh={refresh} />}
          </TabsContent>
        </Tabs>
      ) : current === 'requests' || current === 'borrowed' ? (
        <Tabs value={current} onValueChange={(value) => {
          setCreating(false);
          router.push(officerHref(value as OfficerView));
        }}>
          <TabsList variant="line" className="officer-section-tabs" aria-label="Personal borrowing">
            <TabsTrigger value="requests">My Requests</TabsTrigger>
            <TabsTrigger value="borrowed">Borrowed Equipment</TabsTrigger>
          </TabsList>
          <TabsContent value={current} className="pt-3">
            {current === 'borrowed'
              ? <StudentBorrowed session={session} revision={revision} refresh={refresh} />
              : creating
                ? <RequestBuilder session={session} revision={revision} refresh={refresh} />
                : <Requests approvals={false} session={session} revision={revision} refresh={refresh} />}
          </TabsContent>
        </Tabs>
      ) : (
        <OperationsActivity revision={revision} />
      )}
    </div>
  );
}

function Dashboard({ session, revision }: { session: Session; revision: number }) {
  const allocations = useLendingChoices<Allocation>('allocations', revision);
  const expected = useLendingChoices<Physical>('expected', revision);
  const inspections = useLendingChoices<Physical>('inspections', revision);
  const items = useInventoryLookup<Item>('items', revision);
  const now = useStudentClock(revision);
  const summary = useLending<OperationsSummary>(operationsSummaryQuery(new Date(now)), revision);

  const ready = allocations.data?.items.filter(
    (r) => r.quantity > r.issued && r.borrowerId !== session.user.id
  );
  const due = expected.data?.items.filter(
    (r) => r.borrowerId !== session.user.id && r.returned < r.quantity
  );

  const metrics = [
    { label: 'Ready for handover', value: ready?.length, view: 'handovers', icon: PackageCheck },
    {
      label: 'Returns overdue',
      value: due?.filter((r) => isDue(r, now)).length,
      view: 'returns',
      icon: Undo2,
    },
    {
      label: 'Awaiting inspection',
      value: inspections.data?.items.filter((r) => r.borrowerId !== session.user.id).length,
      view: 'inspections',
      icon: ClipboardCheck,
    },
    {
      label: completedOperationsLabel,
      value: summary.data?.completed.total,
      view: 'activity',
      icon: Activity,
    },
  ] as const;

  return (
    <>
      {[allocations.error, expected.error, inspections.error, summary.error, items.error]
        .filter(Boolean)
        .map((e, i) => (
          <ErrorNotice key={i} message={e!} />
        ))}
      <div className="officer-metrics">
        {metrics.map((m) => (
          <Link key={m.label} href={officerHref(m.view)} className="officer-metric">
            <m.icon size={21} />
            <div>
              <span>{m.label}</span>
              <strong>{m.value ?? '—'}</strong>
            </div>
          </Link>
        ))}
      </div>
      {summary.data && (
        <p className="muted text-xs">
          Today across{' '}
          {summary.data.laboratories.map((l) => l.name).join(', ') || 'no assigned laboratories'}:{' '}
          {summary.data.completed.handovers} handovers; {summary.data.completed.receipts} return
          receipts; {summary.data.completed.inspections} terminal inspections;{' '}
          {summary.data.completed.maintenance} terminal maintenance decisions.
        </p>
      )}
      <div className="officer-columns">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Priority work queue</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.slice(0, 3).map((m) => (
                <Link className="officer-priority" href={officerHref(m.view)} key={m.label}>
                  <span>
                    <strong>{m.label}</strong>
                    <small>Review current laboratory work</small>
                  </span>
                  <Badge variant="secondary">{m.value ?? '—'}</Badge>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4">
          <Records
            title="Ready for handover"
            records={{ data: ready ? { items: ready.slice(0, 5) } : undefined }}
            id={(r) => r.id}
            columns={[
              { id: 'item', title: 'Equipment', value: (r) => r.item },
              { id: 'borrower', title: 'Borrower', value: (r) => r.borrower },
              { id: 'lab', title: 'Laboratory', value: laboratoryName },
              { id: 'quantity', title: 'Qty', value: (r) => r.quantity - r.issued, numeric: true },
              {
                id: 'action',
                title: 'Action',
                value: () => '',
                cell: () => (
                  <Button asChild variant="outline" size="sm">
                    <Link href={officerHref('handovers')}>Process</Link>
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </div>
      <div className="officer-support">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming & overdue returns</CardTitle>
            </CardHeader>
            <CardContent>
              {due
                ?.slice()
                .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
                .slice(0, 5)
                .map((r) => (
                  <Link key={r.id} href={officerHref('returns')} className="officer-priority">
                    <span>
                      <strong>{r.item}</strong>
                      <small>
                        {laboratoryName(r)} / {date(r.dueAt)}
                      </small>
                    </span>
                    <Badge variant={isDue(r, now) ? 'destructive' : 'secondary'}>
                      {isDue(r, now) ? 'Overdue' : 'Outstanding'}
                    </Badge>
                  </Link>
                ))}
              {due?.length === 0 && (
                <OfficerEmpty
                  area="returns"
                  href={officerHref('inventory')}
                  action="Browse inventory"
                />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {items.data?.items.length === 0 && (
                <OfficerEmpty
                  area="inventory"
                  href={officerHref('stock')}
                  action="Record stock receipt"
                />
              )}
              {items.data?.items.slice(0, 5).map((item) => (
                <Link className="officer-priority" key={item.id} href={officerHref('inventory')}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.kind === 'CONSUMABLE' ? 'Consumable' : 'Returnable equipment'}
                    </small>
                  </span>
                  <span>{item.available ?? '—'} available</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="officer-quick">
            {(
              ['handovers', 'returns', 'inspections', 'stock', 'inventory', 'requests'] as const
            ).map((v) => (
              <Button key={v} asChild variant="outline">
                <Link href={officerHref(v)}>
                  <span className="officer-quick-icon">
                    <PackageCheck size={18} />
                  </span>
                  <strong>{officerLabels[v]}</strong>
                  <small>
                    Open workspace <ArrowRight size={12} />
                  </small>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Handovers({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const allocations = useLendingChoices<Allocation>('allocations', revision);
  const requests = useLendingChoices<BorrowRequest>('requests', revision);
  const items = useInventoryLookup<Item>('items', revision);
  const [query, setQuery] = useState('');
  const [lab, setLab] = useState('all');
  const [selected, setSelected] = useState<Allocation>();

  const request = (r: Allocation) =>
    requests.data?.items.find((q) => q.lines.some((l) => l.id === r.lineId));
  const line = (r: Allocation) => request(r)?.lines.find((l) => l.id === r.lineId);

  const rows = allocations.data?.items.filter(
    (r) =>
      r.quantity > r.issued &&
      r.borrowerId !== session.user.id &&
      (lab === 'all' || r.labId === lab) &&
      `${r.item} ${r.borrower} ${request(r)?.id ?? ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const labs = Array.from(
    new Map(allocations.data?.items.map((r) => [r.labId, laboratoryName(r)])).entries()
  );

  return (
    <>
      <div className="officer-queue-metrics">
        <Metric label="Ready for collection" value={rows?.length} />
        <Metric
          label="Items reserved"
          value={rows?.reduce(
            (n, r) =>
              n + Math.max(0, Math.min(r.quantity - r.issued, line(r)?.reservedQuantity ?? 0)),
            0
          )}
        />
        <Metric label="Assigned laboratories" value={labs.length} />
      </div>
      {requests.error && <ErrorNotice message={requests.error} />}
      {items.error && <ErrorNotice message={items.error} />}
      <Records
        filtered={Boolean(query || lab !== 'all')}
        onReset={() => {
          setQuery('');
          setLab('all');
        }}
        title="Assigned laboratory collection queue"
        description="Verify identity and actual equipment before creating a borrowing record."
        records={{ ...allocations, data: rows ? { items: rows } : undefined }}
        id={(r) => r.id}
        tools={
          <>
            <Field>
              <FieldLabel htmlFor="handover-search">Search borrower, item or request</FieldLabel>
              <Input
                id="handover-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Choice
              label="Laboratory"
              value={lab}
              onChange={setLab}
              options={[
                { value: 'all', label: 'All authorized laboratories' },
                ...labs.map(([value, label]) => ({ value, label })),
              ]}
            />
          </>
        }
        columns={[
          { id: 'item', title: 'Equipment', value: (r) => r.item },
          { id: 'borrower', title: 'Borrower', value: (r) => r.borrower },
          { id: 'lab', title: 'Laboratory', value: (r) => laboratoryName(r) },
          {
            id: 'quantity',
            title: 'Reserved',
            value: (r) =>
              Math.max(0, Math.min(r.quantity - r.issued, line(r)?.reservedQuantity ?? 0)),
            numeric: true,
          },
          {
            id: 'action',
            title: 'Action',
            value: () => '',
            cell: (r) => (
              <Button
                variant="outline"
                disabled={!line(r) || line(r)?.stage !== 'APPROVED' || !items.data}
                onClick={() => setSelected(r)}
              >
                Review handover
              </Button>
            ),
          },
        ]}
      />
      <ReviewSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title="Verify & hand over equipment"
        description="Approval is complete. Verify the actual borrower and physical unit before confirming."
      >
        {selected && request(selected) && line(selected) && (
          <HandoverForm
            key={selected.id}
            session={session}
            allocation={selected}
            request={request(selected)!}
            kind={items.data?.items.find((i) => i.id === selected.itemId)?.kind ?? ''}
            revision={revision}
            saved={() => {
              setSelected(undefined);
              refresh();
            }}
          />
        )}
      </ReviewSheet>
    </>
  );
}

function HandoverForm({
  session,
  allocation: a,
  request: r,
  kind,
  revision,
  saved,
}: {
  session: Session;
  allocation: Allocation;
  request: BorrowRequest;
  kind: string;
  revision: number;
  saved: () => void;
}) {
  const assets = useLendingChoices<{ assetId: string; serial?: string }>(
    `handover-assets?allocationId=${encodeURIComponent(a.id)}`,
    revision
  );
  const [asset, setAsset] = useState('anonymous');
  const line = r.lines.find((l) => l.id === a.lineId)!;
  const remaining = Math.min(a.quantity - a.issued, line.reservedQuantity);

  return (
    <ActionForm
      confirmationContext={
        <dl className="review-facts">
          <div>
            <dt>Selected physical unit</dt>
            <dd>
              {kind === 'CONSUMABLE'
                ? 'Consumable quantity'
                : asset === 'anonymous'
                  ? 'Identify from anonymous reserved stock'
                  : asset}
            </dd>
          </div>
        </dl>
      }
      title="Confirm physical handover"
      path="issues"
      session={session}
      onSaved={saved}
      body={(d) => ({
        allocationId: a.id,
        expectedVersion: line.version,
        quantity: Number(d.get('quantity')),
        ...handoverRemarks(d.get('remarks')),
        ...(kind === 'RETURNABLE'
          ? asset !== 'anonymous'
            ? { assetId: asset }
            : String(d.get('serial') ?? '').trim()
              ? { serial: String(d.get('serial')).trim() }
              : {}
          : {}),
      })}
    >
      <dl className="review-facts">
        <div>
          <dt>Borrower</dt>
          <dd>
            {a.borrower} / {a.borrowerId}
          </dd>
        </div>
        <div>
          <dt>Equipment</dt>
          <dd>{a.item}</dd>
        </div>
        <div>
          <dt>Approved / remaining</dt>
          <dd>
            {line.quantity} / {remaining}
          </dd>
        </div>
        <div>
          <dt>Expected return</dt>
          <dd>{date(r.returnAt)}</dd>
        </div>
        <div>
          <dt>Laboratory / location</dt>
          <dd>
            {laboratoryName(a)} / {line.location ?? 'Assigned location'}
          </dd>
        </div>
        <div>
          <dt>Policy / approval</dt>
          <dd>
            {line.policy} / {line.stage}
          </dd>
        </div>
      </dl>
      <details>
        <summary>Approval decisions</summary>
        {line.decisions.map((d) => (
          <p key={d.id}>
            {d.actor}: {d.stage} / {d.decision} — {d.remarks}
          </p>
        ))}
      </details>
      <Field>
        <FieldLabel htmlFor="handover-qty">Quantity physically handed over</FieldLabel>
        <Input
          id="handover-qty"
          name="quantity"
          type="number"
          min={1}
          max={kind === 'CONSUMABLE' ? remaining : 1}
          defaultValue={1}
          required
        />
      </Field>
      {kind === 'RETURNABLE' && (
        <>
          {assets.error && <ErrorNotice message={assets.error} />}
          <Choice
            label="Physical unit"
            value={asset}
            onChange={setAsset}
            options={[
              { value: 'anonymous', label: 'Assign an identity to one reserved unit' },
              ...(assets.data?.items ?? []).map((a) => ({
                value: a.assetId,
                label: a.assetId + (a.serial ? ' / ' + a.serial : ''),
              })),
            ]}
          />
          {asset === 'anonymous' && (
            <Field>
              <FieldLabel htmlFor="handover-serial">Manufacturer serial / reference (if present)</FieldLabel>
              <Input id="handover-serial" name="serial" maxLength={120} />
            </Field>
          )}
          <Notice>
            The system assigns a permanent internal ID to this unit, with a manufacturer serial
            when available. Use the same identity for its return and inspections.
            Identifying it does not increase the total quantity.
          </Notice>
        </>
      )}
      <label className="flex gap-3 items-center">
        <input type="checkbox" required />I verified the borrower’s identity and physical equipment.
      </label>
      <Field>
        <FieldLabel htmlFor="handover-remarks">Factual handover remarks (optional)</FieldLabel>
        <Textarea id="handover-remarks" name="remarks" maxLength={1000} />
        <p className="muted">
          These immutable facts are visible to the borrower. Include only relevant handover
          observations.
        </p>
      </Field>
    </ActionForm>
  );
}

function PhysicalQueue({
  inspections,
  session,
  revision,
  refresh,
}: {
  inspections: boolean;
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const result = useLendingChoices<Physical>(inspections ? 'inspections' : 'expected', revision);
  const names = useLendingChoices<Loan>('loans', revision);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Physical>();
  const [now] = useState(() => Date.now());

  const borrower = (r: Physical) =>
    names.data?.items.find((l) => l.id === r.id)?.borrower ?? 'Borrower identity unavailable';

  const rows = result.data?.items.filter(
    (r) =>
      r.borrowerId !== session.user.id &&
      (!inspections || r.inspection?.status === 'UNRESOLVED') &&
      `${r.item} ${r.assetId} ${r.requestId ?? ''} ${borrower(r)}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'overdue' ? isDue(r, now) : !isDue(r, now)))
  );

  return (
    <>
      <div className="officer-queue-metrics">
        <Metric
          label={inspections ? 'Awaiting inspection' : 'Outstanding records'}
          value={rows?.length}
        />
        {!inspections && (
          <>
            <Metric label="Overdue" value={rows?.filter((r) => isDue(r, now)).length} />
            <Metric label="Upcoming returns" value={rows?.filter((r) => !isDue(r, now)).length} />
          </>
        )}
      </div>
      {names.error && <ErrorNotice message={names.error} />}
      <Notice>
        {inspections
          ? 'Only a recorded inspection decision releases equipment to Available or routes it to Maintenance. Unresolved equipment remains unavailable.'
          : 'Receipt moves returned equipment into Inspection. Each identified unit is received separately; consumables do not create returns.'}
      </Notice>
      <Records
        filtered={Boolean(query || filter !== 'all')}
        onReset={() => {
          setQuery('');
          setFilter('all');
        }}
        title={inspections ? 'Pending physical inspections' : 'Outstanding equipment returns'}
        records={{ ...result, data: rows ? { items: rows } : undefined }}
        id={(r) => r.inspection?.id ?? r.id}
        tools={
          <>
            <Field>
              <FieldLabel htmlFor="physical-search">
                Search borrower, equipment, request or asset
              </FieldLabel>
              <Input
                id="physical-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            {!inspections && (
              <Choice
                label="Due status"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All outstanding' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'upcoming', label: 'Upcoming' },
                ]}
              />
            )}
          </>
        }
        columns={[
          {
            id: 'item',
            title: 'Equipment / asset',
            value: (r) => r.item,
            cell: (r) => (
              <>
                <strong>{r.item}</strong>
                <small className="block break-all">
                  {r.assetId}
                  {r.serial ? ' / ' + r.serial : ''}
                </small>
                <HandoverFacts handover={r.handover} />
              </>
            ),
          },
          { id: 'lab', title: 'Laboratory', value: laboratoryName },
          { id: 'borrower', title: 'Former borrower', value: borrower },
          {
            id: 'date',
            title: inspections ? 'Received' : 'Expected return',
            value: (r) => date(inspections ? r.inspection?.receipt?.created_at : r.dueAt),
          },
          {
            id: 'status',
            title: inspections ? 'Receipt condition' : 'Outstanding',
            value: (r) =>
              inspections
                ? (r.inspection?.receipt?.condition ?? 'Not supplied')
                : r.quantity - r.returned,
          },
          {
            id: 'action',
            title: 'Action',
            value: () => '',
            cell: (r) => (
              <Button variant="outline" onClick={() => setSelected(r)}>
                {inspections ? 'Inspect item' : 'Receive return'}
              </Button>
            ),
          },
        ]}
      />
      <ReviewSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title={inspections ? 'Inspect returned equipment' : 'Receive returned equipment'}
        description="The server records your identity and revalidates authority and the current record version."
      >
        {selected && (
          <ActionForm
            key={selected.inspection?.id ?? selected.id}
            title={inspections ? 'Record inspection decision' : 'Confirm receipt into inspection'}
            path={inspections ? 'inspections' : 'returns'}
            session={session}
            onSaved={() => {
              setSelected(undefined);
              refresh();
            }}
            body={(d) =>
              inspections
                ? {
                    inspectionId: selected.inspection!.id,
                    expectedVersion: selected.inspection!.version,
                    outcome: d.get('outcome'),
                    condition: d.get('condition'),
                    notes: d.get('notes'),
                  }
                : {
                    loanId: selected.id,
                    expectedVersion: selected.version,
                    quantity: 1,
                    condition: d.get('condition'),
                  }
            }
          >
            <dl className="review-facts">
              <div>
                <dt>Equipment / asset</dt>
                <dd className="break-all">
                  {selected.item} / {selected.assetId}
                </dd>
              </div>
              <div>
                <dt>Borrower</dt>
                <dd>
                  {borrower(selected)} / {selected.borrowerId}
                </dd>
              </div>
              <div>
                <dt>Laboratory</dt>
                <dd>{laboratoryName(selected)}</dd>
              </div>
              <div>
                <dt>Quantity physically received / inspected</dt>
                <dd>1 identified unit</dd>
              </div>
              <div>
                <dt>Officer / inspector</dt>
                <dd>{session.user.displayName}</dd>
              </div>
              <div>
                <dt>Expected return</dt>
                <dd>{date(selected.dueAt)}</dd>
              </div>
            </dl>
            <HandoverFacts handover={selected.handover} />
            {inspections && (
              <>
                <p>Receipt condition: {selected.inspection?.receipt?.condition}</p>
                <Field>
                  <FieldLabel htmlFor="inspection-outcome">Condition outcome</FieldLabel>
                  <Select name="outcome" defaultValue="UNRESOLVED">
                    <SelectTrigger id="inspection-outcome">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNRESOLVED">Unresolved — keep unavailable</SelectItem>
                      <SelectItem value="CLEAR_AVAILABLE">Passed — release to Available</SelectItem>
                      <SelectItem value="ROUTE_MAINTENANCE">
                        Damaged — route to Maintenance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="physical-condition">Observed condition</FieldLabel>
              <Textarea id="physical-condition" name="condition" required maxLength={1000} />
            </Field>
            {inspections && (
              <>
                <Field>
                  <FieldLabel htmlFor="inspection-notes">Inspection remarks</FieldLabel>
                  <Textarea id="inspection-notes" name="notes" required maxLength={1000} />
                </Field>
                <details>
                  <summary>Previous inspection decisions</summary>
                  {selected.inspection?.events.map((e) => (
                    <p key={e.id}>
                      {date(e.created_at)} / {e.actor_id} / {e.outcome}: {e.notes}
                    </p>
                  ))}
                </details>
              </>
            )}
          </ActionForm>
        )}
      </ReviewSheet>
    </>
  );
}

function InventoryArea({
  view,
  session,
  revision,
  refresh,
}: {
  view: string;
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const [lab, setLab] = useState('all');
  const items = useInventoryLookup<Item>(
    'items' + (lab === 'all' ? '' : '?labId=' + encodeURIComponent(lab)),
    revision
  );
  const policies = useLendingChoices<Policy>('policies', revision);
  const now = useStudentClock(revision);
  const summary = useLending<OperationsSummary>(operationsSummaryQuery(new Date(now)), revision);
  const locations = useInventoryLookup<Named>('locations', revision);
  const categories = useInventoryLookup<Named>('categories', revision);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [detail, setDetail] = useState<Item>();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(view === 'imports');
  const [stockOpen, setStockOpen] = useState(view === 'stock');

  const labs = summary.data?.laboratories ?? [];

  const rows = items.data?.items.filter(
    (i) =>
      i.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === 'all' || i.categoryId === category)
  );

  return (
    <>
      <div className="officer-queue-metrics inventory-catalogue-metrics">
        <Metric label="Equipment types" value={rows?.length} />
        <Metric label="Returnable types" value={rows?.filter(i => i.kind === 'RETURNABLE').length} />
        <Metric label="Consumable types" value={rows?.filter(i => i.kind === 'CONSUMABLE').length} />
      </div>
      {[locations.error, categories.error, policies.error, summary.error]
        .filter(Boolean)
        .map((e, i) => (
          <ErrorNotice key={i} message={e!} />
        ))}
      <div className="officer-inventory-toolbar">
        <div><h2>Equipment catalogue</h2>
          <p>Search by equipment name and check availability in your authorized laboratories.</p></div>
        <div className="officer-inventory-actions">
          <Button onClick={() => setReceiptOpen(true)}><Plus className="size-4"/>Add items</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4"/>Import Excel
          </Button>
          <Button variant="outline" onClick={() => setStockOpen(true)}>
            <SlidersHorizontal className="size-4"/>Identify units / corrections
          </Button>
        </div>
      </div>
      <Records
        filtered={Boolean(query || category !== 'all' || lab !== 'all')}
        onReset={() => {
          setQuery('');
          setCategory('all');
          setLab('all');
        }}
        title="Inventory catalogue"
        description="Browse equipment and inspect available quantities, identified units, and locations."
        records={{ ...items, data: rows ? { items: rows } : undefined }}
        id={(i) => i.id}
        tools={
          <>
            <Field>
              <FieldLabel htmlFor="officer-catalogue">Search equipment</FieldLabel>
              <Input
                id="officer-catalogue"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Choice
              label="Laboratory"
              value={lab}
              onChange={(value) => {
                setLab(value);
                setDetail(undefined);
              }}
              options={[
                { value: 'all', label: 'All authorized laboratories' },
                ...labs.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
            <Choice
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: 'All categories' },
                ...(categories.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </>
        }
        columns={[
          {
            id: 'item',
            title: 'Item',
            value: (i) => i.name,
            cell: (i) => (
              <>
                <strong>{i.name}</strong>
                <small className="block">
                  {i.kind === 'CONSUMABLE' ? 'Consumable' : 'Returnable'} ·{' '}
                  {i.uom ?? 'Unit unspecified'}
                </small>
              </>
            ),
          },
          ...(['available', 'reserved', 'borrowed', 'inspection', 'maintenance'] as const).map(
            (key) => ({
              id: key,
              title: key.charAt(0).toUpperCase() + key.slice(1),
              value: (i: Item) => i[key] ?? '—',
            })
          ),
          {
            id: 'action',
            title: 'Action',
            value: () => '',
            cell: (i) => (
              <Button variant="outline" onClick={() => setDetail(i)}>
                Item details
              </Button>
            ),
          },
        ]}
      />
      <ReceiveItemsDialog open={receiptOpen} onOpenChange={setReceiptOpen}
        session={session} labs={labs} locations={locations.data?.items ?? []} onSaved={refresh}/>
      <ReviewSheet open={stockOpen} onOpenChange={setStockOpen}
        title="Identify units & correct stock"
        description="Identify an existing unit or request a separately approved quantity correction."
        variant="stock">
        <OfficerStockActions session={session} items={items.data?.items ?? []}
          labs={labs} locations={locations.data?.items ?? []} revision={revision} onSaved={refresh}/>
      </ReviewSheet>
      <ReviewSheet open={importOpen} onOpenChange={setImportOpen}
        title="Import equipment from Excel"
        description="Review receipts before adding any equipment quantities.">
        <ImportPanel session={session} onSaved={refresh}/>
      </ReviewSheet>
      <ReviewSheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(undefined);
        }}
        variant="equipment"
        title={detail?.name ?? 'Equipment details'}
        description="Locations, policies, assets and recorded movements."
      >
        {detail && (
          <>
            <p className="equipment-approval-note">
              Borrowing approval: {(() => {
                const policy = policies.data?.items.find(p => p.itemId === detail.id)?.policy;
                return !policy || policy === 'UNCONFIGURED'
                  ? 'Not configured — contact the HOD before issuing'
                  : policy.replaceAll('_', ' ').toLowerCase();
              })()}
            </p>
            <ItemDetail item={detail} revision={revision} labId={lab === 'all' ? '' : lab} />
          </>
        )}
      </ReviewSheet>
    </>
  );
}

/** Inventory history is for equipment stock movements, not login or lending events. */
function OperationsActivity({ revision }: { revision: number }) {
  const movements = useInventoryLookup<Movement>('movements', revision);
  const items = useInventoryLookup<Item>('items', revision);
  const [query, setQuery] = useState('');
  const rows = (movements.data?.items ?? [])
    .map((movement) => ({
      id: movement.id,
      label: movement.kind.replaceAll('_', ' ').toLowerCase(),
      date: movement.createdAt,
      equipment: items.data?.items.find(item => item.id === movement.itemId)?.name ?? 'Equipment',
      reason: movement.reason ?? '',
      entries: movement.entries ?? [],
    }))
    .filter(row =>
      `${row.label} ${row.equipment} ${row.reason}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a,b)=>b.date.localeCompare(a.date));
  return <Records
    filtered={Boolean(query)}
    onReset={() => setQuery('')}
    title="Inventory history"
    description="Recorded equipment receipts, identification, transfers and stock adjustments. Borrowing and sign-in activity is kept separately."
    records={{
      data: movements.data && items.data ? { items: rows } : undefined,
      error: movements.error ?? items.error,
    }}
    id={row => row.id}
    tools={<Field>
      <FieldLabel htmlFor="operation-search">Search equipment history</FieldLabel>
      <Input id="operation-search" value={query} placeholder="Equipment, action or reason"
        onChange={event => setQuery(event.target.value)} />
    </Field>}
    columns={[
      {id:'equipment',title:'Equipment',value:row=>row.equipment},
      {id:'label',title:'Action',value:row=>row.label},
      {id:'date',title:'Date',value:row=>row.date,cell:row=>date(row.date)},
      {id:'reason',title:'Reason',value:row=>row.reason||'—'},
      {id:'details',title:'Movement details',value:()=>'',cell:row=>
        <details className="officer-activity-details">
          <summary>View changes</summary>
          {row.entries.length ? <ul>{row.entries.map((entry,index)=>
            <li key={index}>
              {entry.locationName || 'Stock movement'}{entry.state ? ' · '+entry.state.toLowerCase() : ''}
              {' · '}{entry.delta>0?'+':''}{entry.delta}
            </li>
          )}</ul> : <p>Recorded inventory action</p>}
        </details>
      },
    ]}
  />;
}
