'use client';
import { OfficerEmpty } from '@/components/technical-officer/empty-state';
import { LecturerEmpty } from '@/components/lecturer/empty-state';
import { StudentEmptyState } from './student-empty-state';
import { Card } from '@/components/ui/card';
import { StudentDataTable, type StudentColumn } from './student-data-table';
import { ReviewAlertDialog } from '@/components/ui/review-sheet';
import { StudentSelect, NativeSelect } from './student-controls';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ActionForm, Field, useLending } from './shared';
import { RequestBuilder } from './request-builder';
import { RequestDiscussion } from './request-discussion';
import type { BorrowDraft, BorrowRequest, RequestLine, Page } from './api';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item } from '@/components/inventory/api';
import { approvalPath, isStudent } from './student-model';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cancellableQuantity, requestQuery, requestGroup } from './lifecycle-model';
const selectClass = 'min-h-11 border rounded-md bg-white px-3 w-full';
const date = (value: string) => (value ? new Date(value).toLocaleString() : 'Not supplied');
export function Requests({
  approvals,
  session,
  revision,
  refresh,
}: {
  approvals: boolean;
  session: Session;
  revision: number;
  refresh: () => void;
}) {
  const SelectControl = isStudent(session.user.roles) ? StudentSelect : NativeSelect;
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(
    !approvals && searchParams.get('group') === 'drafts' ? 'drafts' : 'all'
  );
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const itemTypes = useInventoryLookup<Item>('items', revision);
  const [type, setType] = useState('');
  const [focusRequest, setFocusRequest] = useState('');
  const result = useLending<Page<BorrowRequest>>(
    requestQuery(focusRequest ? { requestId: focusRequest } : { status, stage, from, to, offset }),
    revision
  );
  const drafts = useLending<Page<BorrowDraft>>(`drafts?limit=20&offset=${offset}`, revision);
  const [selectedId, setSelectedId] = useState('');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selectedId) detailHeading.current?.focus();
  }, [selectedId]);
  const [editing, setEditing] = useState<BorrowDraft>();
  const [cancel, setCancel] = useState<{
    draft?: BorrowDraft;
    line?: RequestLine;
  }>();
  const canDecide = (request: BorrowRequest, line: RequestLine) =>
    request.borrowerId !== session.user.id &&
    ((line.stage === 'LECTURER' &&
      session.user.roles.includes('LECTURER') &&
      line.lecturerId === session.user.id) ||
      (line.stage === 'HOD' &&
        session.user.roles.includes('ADMIN') &&
        line.hodId === session.user.id));
  const rows = (result.data?.items ?? []).filter(
    (request) =>
      (approvals
        ? request.lines.some((line) => canDecide(request, line))
        : request.borrowerId === session.user.id) &&
      (category === 'all' || category === 'drafts' || requestGroup(request) === category) &&
      (!type ||
        request.lines.some(
          (line) => itemTypes.data?.items.find((item) => item.id === line.itemId)?.kind === type
        )) &&
      JSON.stringify(request).toLowerCase().includes(query.toLowerCase())
  );
  const selected = rows.find((request) => request.id === selectedId);
  const draftRows = (drafts.data?.items ?? []).filter(
    (draft) =>
      !draft.cancelled &&
      !draft.submittedId &&
      JSON.stringify(draft).toLowerCase().includes(query.toLowerCase())
  );
  const student = isStudent(session.user.roles);
  const lecturer = session.user.roles.includes('LECTURER');
  const columns: StudentColumn<BorrowRequest>[] = [
    {
      id: 'request',
      title: 'Request ID / Items',
      value: (request) => JSON.stringify(request),
      cell: (request) => (
        <>
          <strong>{request.id.slice(0, 8)}</strong>
          <small className="block">{request.lines.map((line) => line.item).join(', ')}</small>
        </>
      ),
    },
    {
      id: 'created',
      title: 'Created',
      value: (request) => request.createdAt,
      cell: (request) => date(request.createdAt),
    },
    {
      id: 'stage',
      title: 'Approval stage',
      value: (request) => Array.from(new Set(request.lines.map((line) => line.stage))).join(', '),
    },
    {
      id: 'collection',
      title: 'Collection readiness',
      numeric: true,
      value: (request) => request.lines.reduce((n, line) => n + line.reservedQuantity, 0),
      cell: (request) =>
        `${request.lines.reduce((n, line) => n + line.reservedQuantity, 0)} reserved`,
    },
    {
      id: 'status',
      title: 'Status',
      value: (request) => request.summary,
      cell: (request) => <Badge variant="secondary">{request.summary.replaceAll('_', ' ')}</Badge>,
    },
    {
      id: 'action',
      title: 'Action',
      value: () => '',
      sortable: false,
      cell: (request) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setSelectedId(request.id);
          }}
        >
          View
        </Button>
      ),
    },
  ];
  const DetailContainer = student ? Card : 'article';
  const Cancellation = student ? ReviewAlertDialog : LegacyCancellation;
  const resetFilters = () => {
    setQuery('');
    setStatus('');
    setStage('');
    setFrom('');
    setTo('');
    setType('');
    setCategory('all');
    setOffset(0);
    setFocusRequest('');
    setSelectedId('');
  };
  const changed = () => {
    setCancel(undefined);
    refresh();
  };
  if (editing)
    return (
      <>
        <Button variant="outline" onClick={() => setEditing(undefined)}>
          Back to My requests
        </Button>
        <RequestBuilder
          key={editing.id}
          draft={editing}
          session={session}
          revision={revision}
          refresh={refresh}
        />
      </>
    );
  return (
    <section
      className={isStudent(session.user.roles) ? 'cp2-requests student-requests' : 'cp2-requests'}
    >
      <h2>{approvals ? 'Approval inbox' : 'My requests'}</h2>
      {focusRequest && (
        <Button
          variant="outline"
          onClick={() => {
            setFocusRequest('');
            setSelectedId('');
          }}
        >
          Back to filtered request list
        </Button>
      )}
      <div className="cp2-toolbar">
        <label>
          Search this page
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Borrower, equipment or purpose"
          />
        </label>
        {!approvals && (
          <label>
            Request group
            <SelectControl
              className={selectClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setOffset(0);
                setSelectedId('');
              }}
            >
              {[
                ['drafts', 'Drafts'],
                ['pending', 'Awaiting Approval'],
                ['ready', 'Reserved for Collection'],
                ['borrowed', 'Currently Borrowed / Completed'],
                ['closed', 'Rejected / Cancelled'],
                ['all', 'All submitted requests'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectControl>
          </label>
        )}
        <label>
          Summary
          <SelectControl
            className={selectClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All summaries</option>
            {[
              'PENDING',
              'MIXED',
              'READY',
              'AWAITING_STOCK',
              'PARTIALLY_FULFILLED',
              'FULFILLED',
              'REJECTED',
              'CANCELLED',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </SelectControl>
        </label>
        <label>
          Approval stage
          <SelectControl
            className={selectClass}
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All stages</option>
            {['LECTURER', 'HOD', 'APPROVED', 'REJECTED', 'CANCELLED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </SelectControl>
        </label>
        <label>
          Equipment type
          <SelectControl
            className={selectClass}
            value={type}
            disabled={!itemTypes.data}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="RETURNABLE">Returnable</option>
            <option value="CONSUMABLE">Consumable</option>
          </SelectControl>
        </label>
        <label>
          Created from
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Created before
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>
      {itemTypes.error && <ErrorNotice message={itemTypes.error} />}
      {result.error && <ErrorNotice message={result.error} />}
      {!approvals && category === 'drafts' ? (
        <>
          {drafts.error && <ErrorNotice message={drafts.error} />}
          {!drafts.data && !drafts.error && <p role="status">Loading owned drafts…</p>}
          {drafts.data && !draftRows.length && (
            <>
              {student ? (
                <StudentEmptyState
                  kind="drafts"
                  filtered={Boolean(query || offset)}
                  onReset={() => {
                    setQuery('');
                    setOffset(0);
                  }}
                />
              ) : lecturer ? (
                <LecturerEmpty
                  kind="drafts"
                  filtered={Boolean(query || offset)}
                  onReset={() => {
                    setQuery('');
                    setOffset(0);
                  }}
                  href="/borrowing?view=new"
                  action="New borrowing request"
                />
              ) : (
                <p>No editable drafts on this page.</p>
              )}
            </>
          )}
          {draftRows.map((draft) => (
            <article className="records p-4" key={draft.id}>
              <h3>{draft.payload.purpose || 'Untitled draft'}</h3>
              <p>
                {draft.payload.lines.length} items · Saved {date(draft.updatedAt)} · Version{' '}
                {draft.version}
              </p>
              {draft.predecessorId && (
                <p>Correction of request {draft.predecessorId}; original history is preserved.</p>
              )}
              <Button onClick={() => setEditing(draft)}>Open and edit draft</Button>{' '}
              <Button variant="outline" onClick={() => setCancel({ draft })}>
                Cancel draft
              </Button>
            </article>
          ))}
        </>
      ) : (
        <>
          {!result.data && !result.error && <p role="status">Loading requests…</p>}
          {!student &&
            result.data &&
            !rows.length &&
            (lecturer ? (
              <LecturerEmpty
                kind={approvals ? 'approvals' : 'requests'}
                filtered={Boolean(
                  query ||
                  status ||
                  stage ||
                  from ||
                  to ||
                  type ||
                  offset ||
                  (!approvals && category !== 'all')
                )}
                onReset={resetFilters}
                href={approvals ? undefined : '/borrowing?view=new'}
                action={approvals ? undefined : 'New borrowing request'}
              />
            ) : (
              <OfficerEmpty
                area="personal requests"
                filtered={Boolean(
                  query || status || stage || from || to || type || offset || category !== 'all'
                )}
                onReset={resetFilters}
                href="/borrowing?view=new"
                action="Create a request"
              />
            ))}
          <div className={student && !rows.length ? 'cp2-inbox is-empty' : 'cp2-inbox'}>
            <div aria-label="Request list" className="cp2-list">
              {student ? (
                result.data ? (
                  <StudentDataTable
                    data={rows}
                    columns={columns}
                    query={query}
                    recordId={(request) => request.id}
                    selectedId={selectedId}
                    label="My Requests"
                    emptyKind="requests"
                    filtered={Boolean(
                      query || status || stage || from || to || type || offset || category !== 'all'
                    )}
                    onReset={resetFilters}
                  />
                ) : null
              ) : session.user.roles.includes('TECHNICAL_OFFICER') && !rows.length ? null : (
                <div
                  className="table-region"
                  role="region"
                  tabIndex={0}
                  aria-label="Request list; horizontal scrolling available"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'Request ID / Items',
                          'Created',
                          'Approval stage',
                          'Collection readiness',
                          'Status',
                          'Action',
                        ].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((request) => (
                        <TableRow
                          key={request.id}
                          data-state={selectedId === request.id ? 'selected' : undefined}
                        >
                          <TableCell>
                            <strong>{request.id.slice(0, 8)}</strong>
                            <small className="block">
                              {request.lines.map((l) => l.item).join(', ')}
                            </small>
                          </TableCell>
                          <TableCell>{date(request.createdAt)}</TableCell>
                          <TableCell>
                            {Array.from(new Set(request.lines.map((l) => l.stage))).join(', ')}
                          </TableCell>
                          <TableCell>
                            {request.lines.reduce((n, l) => n + l.reservedQuantity, 0)} reserved
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {request.summary.replaceAll('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              onClick={(event) => {
                                returnFocus.current = event.currentTarget;
                                setSelectedId(request.id);
                              }}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            {selected ? (
              <DetailContainer className="cp2-detail records p-4">
                <div className="section-heading">
                  <h3 ref={detailHeading} tabIndex={-1}>
                    {selected.purpose}
                  </h3>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedId('');
                      returnFocus.current?.focus();
                    }}
                  >
                    Close details
                  </Button>
                </div>
                <p>Request {selected.id.slice(0, 8)}</p>
                <dl className="review-facts">
                  <div>
                    <dt>Requester</dt>
                    <dd>{selected.borrower}</dd>
                  </div>
                  <div>
                    <dt>Batch</dt>
                    <dd>{selected.batchId || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Collection</dt>
                    <dd>{date(selected.collectAt)}</dd>
                  </div>
                  <div>
                    <dt>Expected Return Date</dt>
                    <dd>{date(selected.returnAt)}</dd>
                  </div>
                  <div>
                    <dt>Summary</dt>
                    <dd>{selected.summary.replaceAll('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt>Revision</dt>
                    <dd>
                      {selected.revision} · version {selected.version}
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary>Request and revision lineage</summary>
                  <p>{selected.id}</p>
                  {selected.predecessorId && (
                    <p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setFocusRequest(selected.predecessorId!);
                          setSelectedId(selected.predecessorId!);
                          setCategory('all');
                        }}
                      >
                        Open predecessor {selected.predecessorId}
                      </Button>
                    </p>
                  )}
                  <p>
                    Earlier decisions remain immutable. See authorized request history and linked
                    drafts for previous revisions.
                  </p>
                </details>
                {approvals && selected.lines.some(line => canDecide(selected, line)) && (
                  <ActionForm
                    key={selected.id + ':' + selected.version}
                    title="Review entire request"
                    path="order-decisions"
                    session={session}
                    onSaved={() => {setSelectedId('');refresh();}}
                    body={data => ({
                      requestId:selected.id,
                      expectedVersion:selected.version,
                      decision:data.get('decision'),
                      remarks:data.get('remarks')
                    })}
                  >
                    <p>This decision applies to the complete request of {selected.lines.length} items.</p>
                    <label>
                      Decision
                      <SelectControl name="decision" className={selectClass}>
                        <option value="APPROVE">Approve request</option>
                        <option value="REJECT">Reject request</option>
                      </SelectControl>
                    </label>
                    <Field name="remarks" label="Decision remarks" />
                  </ActionForm>
                )}
                {selected.lines.map((line) => (
                  <section className="request-line border p-4" key={line.id}>
                    <h4>{line.item}</h4>
                    <p>
                      {line.lab || line.labId} / {line.location || line.locationId}
                    </p>
                    <Badge variant="secondary">{line.stage}</Badge>
                    <p>
                      Requested {line.quantity} · Cancelled {line.cancelledQuantity} · Handed over{' '}
                      {line.issuedQuantity} · Reserved {line.reservedQuantity}
                    </p>
                    <p>
                      Approval path: {approvalPath(line.policy)} · version {line.version}
                    </p>
                    <h5>Decision history</h5>
                    {!line.decisions.length &&
                      (student ? (
                        <StudentEmptyState kind="decisions" />
                      ) : (
                        <p>No academic decisions recorded.</p>
                      ))}
                    <ol>
                      {line.decisions.map((decision) => (
                        <li key={decision.id}>
                          {date(decision.createdAt)} · {decision.actor} · {decision.stage}:{' '}
                          {decision.decision}
                          <p>{decision.remarks}</p>
                        </li>
                      ))}
                    </ol>
                    {selected.borrowerId === session.user.id && (
                      <>
                        {cancellableQuantity(line) > 0 && (
                          <Button variant="outline" onClick={() => setCancel({ line })}>
                            Cancel unissued quantity
                          </Button>
                        )}
                        {line.stage === 'APPROVED' && cancellableQuantity(line) > 0 && (
                          <ActionForm
                            title="Retry stock reservation"
                            path="reserve"
                            session={session}
                            onSaved={refresh}
                            body={() => ({
                              lineId: line.id,
                              expectedVersion: line.version,
                            })}
                          >
                            <p>Try reserving the approved remainder using current stock.</p>
                          </ActionForm>
                        )}
                      </>
                    )}
                  </section>
                ))}
                {selected.borrowerId === session.user.id &&
                  selected.lines.some((line) => line.stage === 'REJECTED') && (
                    <ActionForm
                      title="Create correction draft"
                      path="revisions"
                      session={session}
                      onSaved={() => {
                        setCategory('drafts');
                        setOffset(0);
                        setFocusRequest('');
                        refresh();
                      }}
                      body={() => ({
                        requestId: selected.id,
                        expectedVersion: selected.version,
                      })}
                    >
                      <p>
                        Copy only rejected lines into a linked editable draft. Original quantities,
                        decisions and comments remain unchanged. Open the draft to correct and
                        explicitly submit it.
                      </p>
                    </ActionForm>
                  )}
                <RequestDiscussion requestId={selected.id} session={session} revision={revision} />
              </DetailContainer>
            ) : student ? (
              rows.length > 0 ? (
                <Card className="cp2-detail student-detail-prompt">
                  <StudentEmptyState
                    kind="detail"
                    actionLabel="View first request"
                    onAction={() => setSelectedId(rows[0].id)}
                  />
                </Card>
              ) : null
            ) : (session.user.roles.includes('TECHNICAL_OFFICER') || lecturer) &&
              !rows.length ? null : (
              <p className="cp2-detail">
                Select a request to review its items, dates and complete decision history.
              </p>
            )}
          </div>
        </>
      )}
      {((!student && !lecturer) ||
        (category === 'drafts' ? draftRows.length : rows.length) > 0) && (
        <div className="pagination">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - 20));
              setSelectedId('');
            }}
          >
            Previous
          </Button>
          <span>
            Server page {offset / 20 + 1}. Search and request groups apply within this page.
          </span>
          <Button
            variant="outline"
            disabled={
              (category === 'drafts' && !approvals
                ? drafts.data?.items.length
                : result.data?.items.length) !== 20
            }
            onClick={() => {
              setOffset(offset + 20);
              setSelectedId('');
            }}
          >
            Next
          </Button>
        </div>
      )}
      <Cancellation
        open={Boolean(cancel)}
        onOpenChange={(open) => {
          if (!open) setCancel(undefined);
        }}
        title={cancel?.draft ? 'Cancel saved draft' : 'Cancel unissued quantity'}
        description="This closes the selected handover rights and releases any corresponding reservation. Equipment already handed over remains with the borrower and must be returned."
      >
        {cancel && (
          <ActionForm
            title="Confirm cancellation"
            path="cancel"
            session={session}
            onSaved={changed}
            body={(data) => ({
              ...(cancel.draft
                ? {
                    draftId: cancel.draft.id,
                    expectedVersion: cancel.draft.version,
                  }
                : {
                    lineId: cancel.line!.id,
                    expectedVersion: cancel.line!.version,
                    quantity: Number(data.get('quantity')),
                  }),
              reason: data.get('reason'),
            })}
          >
            {cancel.line && (
              <label>
                Quantity to cancel (maximum {cancellableQuantity(cancel.line)})
                <Input
                  name="quantity"
                  type="number"
                  min={1}
                  max={cancellableQuantity(cancel.line)}
                  step={1}
                  defaultValue={1}
                  required
                />
              </label>
            )}
            <Field name="reason" label="Cancellation reason" />
          </ActionForm>
        )}
      </Cancellation>
    </section>
  );
}

function LegacyCancellation({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
