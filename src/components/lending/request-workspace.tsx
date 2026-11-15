'use client';
import { OfficerEmpty } from '@/components/technical-officer/empty-state';
import { LecturerEmpty } from '@/components/lecturer/empty-state';
import { StudentEmptyState } from './student-empty-state';
import { ReviewAlertDialog, ReviewSheet } from '@/components/ui/review-sheet';
import { StudentSelect, NativeSelect } from './student-controls';
import { useState, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, ChevronRight, Package, Check } from 'lucide-react';
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
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'equipment'>('newest');
  const itemTypes = useInventoryLookup<Item>('items', revision);
  const [type, setType] = useState('');
  const [focusRequest, setFocusRequest] = useState('');
  const result = useLending<Page<BorrowRequest>>(
    requestQuery(focusRequest ? { requestId: focusRequest } : { status, stage, from, to, offset }),
    revision
  );
  const drafts = useLending<Page<BorrowDraft>>(`drafts?limit=20&offset=${offset}`, revision);
  const [selectedId, setSelectedId] = useState('');
  const returnFocus = useRef<HTMLButtonElement>(null);
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
  const selected = (result.data?.items ?? []).find((request) => request.id === selectedId);
  const sortedRows = [...rows].sort((a, b) =>
    sortBy === 'equipment'
      ? (a.lines[0]?.item ?? '').localeCompare(b.lines[0]?.item ?? '') ||
        b.createdAt.localeCompare(a.createdAt)
      : sortBy === 'oldest'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt)
  );
  const categories: { value: string; label: string }[] = [
    { value: 'all', label: 'All requests' },
    { value: 'pending', label: 'Pending' },
    { value: 'ready', label: 'Ready' },
    { value: 'borrowed', label: 'Borrowed' },
    { value: 'closed', label: 'Closed' },
    { value: 'drafts', label: 'Drafts' },
  ];
  const tabCount = (group: string) =>
    group === 'drafts'
      ? (drafts.data?.items ?? []).filter((draft) => !draft.cancelled && !draft.submittedId).length
      : (result.data?.items ?? []).filter((request) =>
          request.borrowerId === session.user.id && (group === 'all' || requestGroup(request) === group)
        ).length;
  const hasFilters = Boolean(query || status || stage || type || from || to || offset ||
    (!approvals && category !== 'all'));
  const draftRows = (drafts.data?.items ?? []).filter(
    (draft) =>
      !draft.cancelled &&
      !draft.submittedId &&
      JSON.stringify(draft).toLowerCase().includes(query.toLowerCase())
  );
  const student = isStudent(session.user.roles);
  const lecturer = session.user.roles.includes('LECTURER');
  const openRequest = (requestId: string, button?: HTMLButtonElement) => {
    if (button) returnFocus.current = button;
    setSelectedId(requestId);
  };
  const closeRequest = () => {
    setSelectedId('');
    returnFocus.current?.focus();
  };
  const approvalStatus = (request: BorrowRequest) => {
    const stages = new Set(request.lines.map((line) => line.stage));
    if (stages.has('REJECTED')) return 'Requires attention';
    if (stages.has('CANCELLED')) return 'Cancelled';
    if (stages.has('LECTURER') && stages.has('HOD')) return 'Multiple approvals';
    if (stages.has('LECTURER')) return 'Lecturer review';
    if (stages.has('HOD')) return 'HOD review';
    return stages.size > 1 ? 'Mixed stages' : 'Approved';
  };
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
    setAdvancedFilters(false);
  };
  const changed = () => {
    setCancel(undefined);
    refresh();
  };
  return (
    <section
      className={isStudent(session.user.roles) ? 'cp2-requests request-inbox student-requests' : 'cp2-requests request-inbox'}
    >
      <div className="request-inbox-heading">
        <div>
          <h2>{approvals ? 'Approval inbox' : 'Requests'}</h2>
          <p>{approvals
            ? 'Review requests assigned to you and record item decisions.'
            : 'Find a request, check its status, or resume a saved draft.'}</p>
        </div>
        {!approvals && <Button asChild size="sm">
          <Link href="/borrowing?view=new">New request</Link>
        </Button>}
      </div>
      {!approvals && (
        <nav className="request-inbox-tabs" aria-label="Request status filters">
          {categories.map((group) => (
            <button
              type="button"
              key={group.value}
              className={category === group.value ? 'is-active' : ''}
              aria-current={category === group.value ? 'page' : undefined}
              onClick={() => {
                setCategory(group.value);
                setOffset(0);
                setSelectedId('');
              }}
            >
              {group.label}
              <span>{tabCount(group.value)}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="request-inbox-controls">
        <label className="request-inbox-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search requests</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by equipment, purpose or request ID"
            aria-label="Search requests"
          />
        </label>
        <label className="request-inbox-sort">
          <span>Sort</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="equipment">Equipment name</option>
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={advancedFilters}
          aria-controls="request-inbox-advanced"
          onClick={() => setAdvancedFilters((value) => !value)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters{Boolean(status || stage || type || from || to) ? ' •' : ''}
        </Button>
        {hasFilters && <Button size="sm" variant="ghost" onClick={resetFilters}>Clear</Button>}
      </div>
      {advancedFilters && <div id="request-inbox-advanced" className="request-inbox-advanced">
        <label>
          Summary
          <SelectControl className={selectClass} value={status} onChange={(event) => {setStatus(event.target.value);setOffset(0);}}>
            <option value="">All summaries</option>
            {['PENDING','MIXED','READY','AWAITING_STOCK','PARTIALLY_FULFILLED','FULFILLED','REJECTED','CANCELLED'].map((value) =>
              <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
          </SelectControl>
        </label>
        <label>
          Approval stage
          <SelectControl className={selectClass} value={stage} onChange={(event) => {setStage(event.target.value);setOffset(0);}}>
            <option value="">All stages</option>
            {['LECTURER','HOD','APPROVED','REJECTED','CANCELLED'].map((value) =>
              <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
          </SelectControl>
        </label>
        <label>
          Equipment type
          <SelectControl className={selectClass} value={type} disabled={!itemTypes.data} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option><option value="RETURNABLE">Returnable</option><option value="CONSUMABLE">Consumable</option>
          </SelectControl>
        </label>
        <label>
          Created from
          <Input type="date" value={from} onChange={(event) => {setFrom(event.target.value);setOffset(0);}} />
        </label>
        <label>
          Created before
          <Input type="date" value={to} onChange={(event) => {setTo(event.target.value);setOffset(0);}} />
        </label>
      </div>}
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
          {drafts.data && draftRows.length > 0 && (
            <div className="request-inbox-table-area">
              <div className="request-inbox-table-scroll" role="region" aria-label="Draft requests; horizontal scrolling available" tabIndex={0}>
                <Table>
                  <TableHeader><TableRow><TableHead>Draft request</TableHead><TableHead>Items</TableHead>
                    <TableHead>Saved</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{draftRows.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell><div className="request-inbox-equipment">
                        <span className="request-inbox-equipment-icon"><Package size={17} aria-hidden="true"/></span>
                        <span><strong>{draft.payload.purpose || 'Untitled draft'}</strong>
                          <small>#{draft.id.slice(0,8)} {draft.predecessorId ? '· Correction draft' : '· Draft'}</small></span>
                      </div></TableCell>
                      <TableCell>{draft.payload.lines.length} item types</TableCell>
                      <TableCell className="request-inbox-date">{date(draft.updatedAt)}</TableCell>
                      <TableCell><div className="request-inbox-draft-actions">
                        <Button asChild size="sm"><Link href={`/borrowing?view=new&draftId=${encodeURIComponent(draft.id)}`}>Continue</Link></Button>
                        <Button size="sm" variant="outline" onClick={() => setCancel({ draft })}>Cancel</Button>
                      </div></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </div>
          )}
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
          <div className="request-inbox-table-area">
            {result.data && sortedRows.length > 0 && (
              <div className="request-inbox-table-scroll" role="region" aria-label="Request table; horizontal scrolling available" tabIndex={0}>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Request / equipment</TableHead><TableHead>Created</TableHead>
                    <TableHead>Approval</TableHead><TableHead>Collection</TableHead>
                    <TableHead>Status</TableHead><TableHead>Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{sortedRows.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell><div className="request-inbox-equipment">
                        <span className="request-inbox-equipment-icon"><Package size={17} aria-hidden="true"/></span>
                        <span><strong>{request.lines.length === 1 ? request.lines[0].item : (request.lines[0]?.item ?? 'Equipment') + ' +' + (request.lines.length - 1)}</strong>
                        <small>#{request.id.slice(0, 8)} · {request.lines.reduce((n, line) => n + line.quantity, 0)} units</small></span>
                      </div></TableCell>
                      <TableCell className="request-inbox-date">{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell><span className="request-inbox-approval">{approvalStatus(request)}</span></TableCell>
                      <TableCell>{request.summary === 'READY' ? 'Ready to collect' : request.lines.some((line) => line.reservedQuantity > 0) ? 'Partially reserved' : 'Not ready'}</TableCell>
                      <TableCell><span className={'request-inbox-status status-' + requestGroup(request)}>{request.summary.replaceAll('_', ' ')}</span></TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={(event) => openRequest(request.id, event.currentTarget)}>
                          View <ChevronRight size={14} aria-hidden="true"/>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
            {result.data && !sortedRows.length && (student ?
              <StudentEmptyState kind="requests" filtered={hasFilters} onReset={resetFilters}/> :
              <p className="request-inbox-empty">No requests match these filters.</p>)}
            {result.data && sortedRows.length > 0 && <p className="request-inbox-count">{sortedRows.length} request{sortedRows.length === 1 ? '' : 's'} on this page</p>}
          </div>
          <ReviewSheet
            open={Boolean(selected)}
            onOpenChange={(open) => { if (!open) closeRequest(); }}
            variant="request"
            title={selected ? 'Request #' + selected.id.slice(0, 8) : 'Request details'}
            description={selected ? selected.purpose : 'Review request details'}
          >
            {selected && (
              <div className="request-detail-content">
                <div className="request-detail-intro">
                  <span className={'request-inbox-status status-' + requestGroup(selected)}>{selected.summary.replaceAll('_', ' ')}</span>
                  <h3>{selected.purpose}</h3>
                  <p>{date(selected.createdAt)}</p>
                </div>
                <div className="request-detail-progress" aria-label="Request progress">
                  {['Submitted', 'Approved', 'Ready', 'Collected'].map((label, index) => {
                    const done = index === 0 ||
                      (index === 1 && selected.lines.every(line =>
                        line.stage === 'APPROVED' ||
                        (line.issuedQuantity > 0 && line.issuedQuantity >= line.quantity - line.cancelledQuantity))) ||
                      (index === 2 && selected.lines.every(line =>
                        line.reservedQuantity + line.issuedQuantity >= line.quantity - line.cancelledQuantity &&
                        !['LECTURER', 'HOD', 'REJECTED'].includes(line.stage))) ||
                      (index === 3 && selected.lines.every(line =>
                        line.issuedQuantity > 0 && line.issuedQuantity >= line.quantity - line.cancelledQuantity));
                    return <div key={label} className={done ? 'is-done' : ''}>
                      <span>{done ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                      <small>{label}</small>
                    </div>;
                  })}
                </div>
                <dl className="review-facts">
                  <div><dt>Requester</dt><dd>{selected.borrower}</dd></div>
                  {selected.batchId && <div><dt>Batch</dt><dd>{selected.batchId}</dd></div>}
                  <div><dt>Collection</dt><dd>{date(selected.collectAt)}</dd></div>
                  <div><dt>Expected return</dt><dd>{date(selected.returnAt)}</dd></div>
                </dl>
                {selected.predecessorId && (
                  <details className="request-detail-technical">
                    <summary>Previous request</summary>
                    <Button variant="link" onClick={() => {
                      setFocusRequest(selected.predecessorId!);
                      setSelectedId(selected.predecessorId!);
                      setCategory('all');
                    }}>View linked request</Button>
                  </details>
                )}
                <div className="request-detail-section-heading">
                  <h4>Equipment</h4><span>{selected.lines.length} {selected.lines.length === 1 ? 'type' : 'types'}</span>
                </div>
                {selected.lines.map((line) => {
                  const outstanding = line.quantity - line.cancelledQuantity - line.issuedQuantity - line.reservedQuantity;
                  return (
                    <section className="request-detail-item" key={line.id}>
                      <div className="request-detail-item-head">
                        <h4>{line.item}</h4>
                        <Badge variant="secondary">{line.stage.replaceAll('_', ' ')}</Badge>
                      </div>
                      <p>{line.quantity} requested · {line.reservedQuantity} reserved · {line.issuedQuantity} collected</p>
                      {line.policy !== 'NONE' && <p>Approval: {approvalPath(line.policy)}</p>}
                      {line.decisions.length > 0 && (
                        <details className="request-detail-item-history">
                          <summary>Approval history</summary>
                          <ol>{line.decisions.map(decision =>
                            <li key={decision.id}><strong>{decision.actor} · {decision.decision}</strong>
                              <p>{date(decision.createdAt)}</p>
                              {decision.remarks && <p>{decision.remarks}</p>}
                            </li>)}</ol>
                        </details>
                      )}
                      {approvals && canDecide(selected, line) && (
                        <ActionForm
                          compact
                          key={line.id + ':' + line.version}
                          title="Record decision"
                          path="decisions"
                          session={session}
                          onSaved={refresh}
                          body={(data) => ({
                            lineId: line.id,
                            expectedVersion: line.version,
                            decision: data.get('decision'),
                            remarks: data.get('remarks'),
                          })}
                        >
                          <label>Decision
                            <SelectControl name="decision" className={selectClass}>
                              <option value="APPROVE">Approve</option><option value="REJECT">Reject</option>
                            </SelectControl>
                          </label>
                          <Field name="remarks" label="Remarks" />
                        </ActionForm>
                      )}
                      {selected.borrowerId === session.user.id && (
                        <div className="request-detail-item-actions">
                          {cancellableQuantity(line) > 0 && (
                            <details className="request-detail-optional-action">
                              <summary>Request actions</summary>
                              <Button type="button" size="sm" variant="outline" onClick={() => setCancel({ line })}>
                                Cancel unissued quantity
                              </Button>
                            </details>
                          )}
                          {line.stage === 'APPROVED' && outstanding > 0 && (
                            <details className="request-detail-optional-action">
                              <summary>Stock unavailable? Retry reservation</summary>
                              <ActionForm
                                compact
                                title="Retry reservation"
                                path="reserve"
                                session={session}
                                onSaved={refresh}
                                body={() => ({lineId: line.id, expectedVersion: line.version})}
                              >
                                <p>Check current stock availability.</p>
                              </ActionForm>
                            </details>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
                {selected.borrowerId === session.user.id &&
                  selected.lines.some((line) => line.stage === 'REJECTED') && (
                    <ActionForm
                      compact
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
                      <p>Create a new draft to correct rejected items.</p>
                    </ActionForm>
                  )}
                <details className="request-detail-comments">
                  <summary>Comments</summary>
                  <RequestDiscussion compact requestId={selected.id} session={session} revision={revision} />
                </details>
              </div>
            )}
          </ReviewSheet>
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
