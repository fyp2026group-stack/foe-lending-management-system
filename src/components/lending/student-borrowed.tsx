'use client';
import { OfficerEmpty } from '@/components/technical-officer/empty-state';
import { studentActivity, type StudentActivity } from './student-activity';
import type { BorrowRequest } from './api';
import { HandoverFacts } from './handover-facts';
import { StudentEmptyState } from './student-empty-state';
import { useState } from 'react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentClock } from './student-clock';
import { isStudentOverdue } from './student-model';
import { StudentSelect } from './student-controls';
import { ReviewSheet } from '@/components/ui/review-sheet';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useLendingChoices, ActionForm, Field } from './shared';
import { StudentDataTable, type StudentColumn } from './student-data-table';
import type { HistoryEvent } from './api';
import type { Loan } from './api';
type Borrowed = Loan & {
  version: number;
  extension?: { id: string; status: string };
  inspection?: { status: string };
};
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not applicable';
export function StudentBorrowed({
  session,
  revision,
  refresh,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const records = useLendingChoices<Borrowed>('borrower-history', revision);
  const extensions = useLendingChoices<Borrowed>('extensions', revision);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Borrowed>();
  const now = useStudentClock(records.data);
  const overdue = (r: Borrowed) => isStudentOverdue(r, now);
  const pending = (r: Borrowed) =>
    extensions.data?.items.some((e) => e.id === r.id && e.extension?.status === 'PENDING');
  const rows = (records.data?.items ?? []).filter(
    (r) =>
      r.borrowerId === session.user.id &&
      (!query ||
        (r.item + ' ' + (r.requestId ?? '')).toLowerCase().includes(query.toLowerCase())) &&
      (status === 'all' ||
        (status === 'active' && r.returned < r.quantity) ||
        (status === 'returned' && r.returned >= r.quantity) ||
        (status === 'overdue' && overdue(r)))
  );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  return (
    <Card className="student-card">
      <div className="section-heading">
        <h2>Borrowed Equipment</h2>
      </div>
      <div className="student-filters">
        <label>
          Search equipment or request
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Borrowing status
          <StudentSelect
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="active">Currently borrowed</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Returned</option>
            <option value="all">All borrowing</option>
          </StudentSelect>
        </label>
      </div>
      {records.error && <ErrorNotice message={records.error} />}
      {extensions.error && <ErrorNotice message={extensions.error} />}
      {!records.data && !records.error && <p role="status">Loading your borrowed equipment...</p>}
      {records.data && rows.length > 0 && (
        <div
          className="table-region"
          role="region"
          tabIndex={0}
          aria-label="Your borrowed equipment"
        >
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Equipment',
                  'Qty held',
                  'Issued',
                  'Expected return',
                  'Status / return',
                  'Related request',
                  'Action',
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice((current - 1) * 10, current * 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.item}
                    <HandoverFacts handover={r.handover} />
                  </TableCell>
                  <TableCell>{r.quantity - r.returned}</TableCell>
                  <TableCell>{date(r.issuedAt)}</TableCell>
                  <TableCell>{date(r.dueAt)}</TableCell>
                  <TableCell>
                    {r.returned >= r.quantity
                      ? 'Return recorded; inspection is separate'
                      : overdue(r)
                        ? 'Overdue'
                        : 'Borrowed'}
                    {pending(r) && <small className="block">Extension awaiting approval</small>}
                  </TableCell>
                  <TableCell>
                    <details>
                      <summary>{r.requestId?.slice(0, 8) ?? 'Not supplied'}</summary>
                      {r.requestId}
                    </details>
                  </TableCell>
                  <TableCell>
                    {r.returned < r.quantity && r.dueAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!extensions.data || pending(r)}
                        onClick={() => setSelected(r)}
                      >
                        Request extension
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {records.data &&
        !rows.length &&
        (session.user.roles.includes('TECHNICAL_OFFICER') ? (
          <OfficerEmpty
            area="personal borrowing"
            filtered={Boolean(query || status !== 'active')}
            onReset={() => {
              setQuery('');
              setStatus('all');
              setPage(1);
            }}
            href="/operations?view=inventory"
            action="Browse inventory"
          />
        ) : (
          <StudentEmptyState
            kind="borrowed"
            filtered={Boolean(
              query ||
              (records.data?.items.some((record) => record.borrowerId === session.user.id) &&
                status !== 'all')
            )}
            onReset={() => {
              setQuery('');
              setStatus('all');
              setPage(1);
            }}
          />
        ))}
      {records.data && rows.length > 0 && (
        <div className="pagination">
          <Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span>
            Page {current} of {pages} / {rows.length} records
          </span>
          <Button
            variant="outline"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <ReviewSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title="Request a later return date"
        description="The current due date remains in effect until your extension is approved."
      >
        {selected && (
          <ActionForm
            title="Submit extension request"
            path="extensions"
            session={session}
            onSaved={() => {
              setSelected(undefined);
              refresh();
            }}
            body={(data) => ({
              loanId: selected.id,
              expectedVersion: selected.version,
              proposedDueAt: new Date(String(data.get('proposedDueAt'))).toISOString(),
              reason: String(data.get('reason')),
            })}
          >
            <p>
              {selected.item} / Expected return {date(selected.dueAt)}
            </p>
            <label>
              Proposed return date and time
              <Input
                name="proposedDueAt"
                type="datetime-local"
                required
                min={new Date(
                  Math.max(Date.parse(selected.dueAt ?? ''), now) +
                    60000 -
                    new Date(now).getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, 16)}
              />
            </label>
            <Field name="reason" label="Reason for extension" />
          </ActionForm>
        )}
      </ReviewSheet>
    </Card>
  );
}

export function StudentHistory({ revision }: { revision: number }) {
  const history = useLendingChoices<HistoryEvent>('history', revision);
  const requests = useLendingChoices<BorrowRequest>('requests', revision);
  const borrowing = useLendingChoices<Loan>('borrower-history', revision);
  const rows = studentActivity(
    history.data?.items ?? [],
    requests.data?.items ?? [],
    borrowing.data?.items ?? []
  );
  const columns: StudentColumn<StudentActivity>[] = [
    { id: 'activity', title: 'Activity', value: (event) => event.label },
    {
      id: 'when',
      title: 'Recorded',
      value: (event) => event.occurredAt,
      cell: (event) => date(event.occurredAt),
    },
    { id: 'reference', title: 'Request', value: (event) => event.reference },
  ];
  return (
    <Card className="student-catalogue">
      <div className="section-heading p-4">
        <h2>Borrowing History</h2>
      </div>
      {[history.error, requests.error, borrowing.error].filter(Boolean).map((error, i) => (
        <ErrorNotice key={i} message={error!} />
      ))}
      {(!history.data || !requests.data || !borrowing.data) &&
        ![history.error, requests.error, borrowing.error].some(Boolean) && (
          <p role="status" className="p-4">
            Loading your borrowing activity...
          </p>
        )}
      {history.data && requests.data && borrowing.data && (
        <StudentDataTable
          data={rows}
          columns={columns}
          recordId={(event) => event.key}
          label="Borrowing history"
          emptyKind="history"
        />
      )}
    </Card>
  );
}
