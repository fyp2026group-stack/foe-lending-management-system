'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2,
  ClipboardCheck, ClipboardList, Clock3, Minus, Package, Plus,
  Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { Session } from '@/components/identity/api';
import { ApiError } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentClock } from './student-clock';
import { useLendingChoices } from './shared';
import { lendingWrite, type BorrowDraft, type Lecturer, type LendingSource, type DraftPayload } from './api';
import { draftSavePayload, draftSubmitPayload, CommandReplay } from './lifecycle-model';
import { isStudent, readSelection, basketKey, approvalPath } from './student-model';
import { availablePerEquipment, resolveBorrowingSources, type BorrowSelection } from './request-source-selector';

const stepNames = ['Equipment', 'Request details', 'Review', 'Complete'] as const;
function RequestProgress({ current }: { current: number }) {
  return <nav className="borrowing-progress" aria-label="Borrowing request progress">
    <ol>{stepNames.map((label, index) =>
      <li key={label} className={index < current ? 'is-done' : index === current ? 'is-current' : 'is-upcoming'}
        aria-current={index === current ? 'step' : undefined}>
        <span className="borrowing-progress-dot" aria-hidden="true">{index < current || current === 3 ? <Check className="size-5" /> : index + 1}</span>
        <span className="borrowing-progress-label">{label}</span>
      </li>
    )}</ol>
  </nav>;
}
const toLocal = (date?: string) =>
  date ? new Date(new Date(date).getTime() - new Date(date).getTimezoneOffset() * 60000)
    .toISOString().slice(0,16) : '';
const policyRequiresLecturer = (policy: string) => policy === 'LECTURER' || policy === 'BOTH';

export function RequestBuilder({
  session, revision, refresh, draft,
}: {
  session: Session; revision: number; refresh: () => void; draft?: BorrowDraft;
}) {
  const student = isStudent(session.user.roles);
  const now = useStudentClock(revision);
  const sources = useLendingChoices<LendingSource>('sources', revision);
  const lecturers = useLendingChoices<Lecturer>('lecturers', revision);
  const [selected, setSelected] = useState<BorrowSelection[]>(() => {
    if (draft) return Array.from(new Map(draft.payload.lines.map(line =>
      [line.itemId, { itemId: line.itemId, quantity: line.quantity }] as const)).values());
    try {
      return Array.from(new Map(readSelection(sessionStorage.getItem(basketKey(session.user.id)))
        .map(line => [line.itemId, { itemId: line.itemId, quantity: line.quantity }] as const)).values());
    } catch { return []; }
  });
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('ALL');
  const [purpose, setPurpose] = useState(draft?.payload.purpose ?? '');
  const [collectAt, setCollectAt] = useState(toLocal(draft?.payload.collectAt));
  const [returnAt, setReturnAt] = useState(toLocal(draft?.payload.returnAt));
  const [lecturerId, setLecturerId] = useState(draft?.payload.lecturerId ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState('');
  // Internal draft persistence is a backend transaction requirement; there is
  // no user-visible draft step or separate Save Draft action.
  const [internalDraft, setInternalDraft] = useState<BorrowDraft | undefined>(draft);
  const [submissionDraft, setSubmissionDraft] = useState<BorrowDraft | null>(null);
  const replay = useRef(new CommandReplay());

  const choices = sources.data?.items ?? [];
  const inventory = useMemo(() => Array.from(new Map(choices.map(source =>
    [source.itemId, source] as const)).values()).map(source => ({
      id: source.itemId, title: source.item, kind: source.kind, uom: source.uom,
      available: availablePerEquipment(choices, source.itemId),
      policy: source.policy,
    })).sort((a,b) => a.title.localeCompare(b.title)), [choices]);
  const resolved = useMemo(() =>
    resolveBorrowingSources(selected, choices, lecturers.data?.items ?? [], session.user.id),
    [selected, choices, lecturers.data, session.user.id]);
  const needsLecturer = Boolean(resolved?.lines.some(line => policyRequiresLecturer(line.policy)));
  const approvalRequirement = resolved?.lines.some(line => line.policy === 'BOTH' || line.policy === 'HOD')
    ? needsLecturer ? 'Lecturer and HOD' : 'HOD'
    : needsLecturer ? 'Lecturer' : 'No academic approval';
  const chosenLecturer = resolved?.eligible.find(person => person.id === lecturerId)?.id ?? '';
  const dateStart = collectAt ? Date.parse(collectAt) : NaN;
  const dateEnd = returnAt ? Date.parse(returnAt) : NaN;
  const detailsValid = Boolean(purpose.trim() && purpose.trim().length <= 1000 &&
    Number.isFinite(dateStart) && Number.isFinite(dateEnd) &&
    dateStart > now && dateEnd > dateStart &&
    (!needsLecturer || chosenLecturer));
  const matching = inventory.filter(item =>
    item.title.toLowerCase().includes(search.trim().toLowerCase()) &&
    (kind === 'ALL' || item.kind === kind));
  const selectedRows = selected.map(line => ({
    ...line, item: inventory.find(item => item.id === line.itemId),
  }));
  const selectedQuantity = selected.reduce((sum,line) => sum + line.quantity, 0);

  function updateSelection(itemId: string, quantity: number) {
    if (busy || uncertain) return;
    const item = inventory.find(row => row.id === itemId);
    if (!item) return;
    const limit = Math.min(item.available, 1000);
    setSelected(current => quantity <= 0 ? current.filter(row => row.itemId !== itemId) :
      current.some(row => row.itemId === itemId)
        ? current.map(row => row.itemId === itemId
          ? { ...row, quantity: Math.min(Math.max(1,quantity),limit) } : row)
        : current.length < 20 && limit > 0
          ? [...current, { itemId, quantity: Math.min(quantity,limit) }]
          : current);
    setSubmissionDraft(null);
    setMessage('');
  }
  function reset() {
    setStep(0); setSelected([]); setPurpose(''); setCollectAt(''); setReturnAt('');
    setLecturerId(''); setInternalDraft(undefined); setSubmissionDraft(null);
    setSuccess(false); setMessage(''); setSearch(''); setKind('ALL');
  }
  async function act(path: string, payload: Record<string, unknown>) {
    const command = replay.current.prepare(path,payload);
    try {
      const response = await lendingWrite<{ id: string; version: number }>(
        path, command, session.csrfToken);
      replay.current.resolve();
      setUncertain('');
      return response;
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        replay.current.resolve();
        setUncertain('');
      } else {
        setUncertain(path);
      }
      throw err;
    }
  }
  async function submitRequest() {
    if (busy || !resolved || !detailsValid || !selected.length) return;
    setBusy(true); setMessage('');
    try {
      let saved = submissionDraft;
      if (!saved) {
        const payload: DraftPayload = {
          purpose: purpose.trim(),
          collectAt: new Date(dateStart).toISOString(),
          returnAt: new Date(dateEnd).toISOString(),
          ...(needsLecturer ? { lecturerId: chosenLecturer } : {}),
          lines: resolved.lines.map(line => ({
            itemId: line.itemId, labId: line.labId, locationId: line.locationId,
            quantity: line.quantity,
          })),
        };
        const record = await act('drafts',draftSavePayload(payload,internalDraft));
        saved = { ...record, payload, cancelled:false, updatedAt:new Date().toISOString() };
        setInternalDraft(saved); setSubmissionDraft(saved);
      }
      await act('submit', draftSubmitPayload(saved));
      setInternalDraft(undefined); setSubmissionDraft(null);
      try { sessionStorage.removeItem(basketKey(session.user.id)); } catch {}
      setSuccess(true); refresh();
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      if (conflict) setSubmissionDraft(null);
      setMessage(conflict
        ? 'The equipment or request has changed. Review the latest availability and try again.'
        : err instanceof Error ? err.message : 'Unable to complete this request.');
    } finally { setBusy(false); }
  }

  if (sources.error || lecturers.error)
    return <section className="records p-4">
      <h2>Equipment choices are unavailable</h2>
      {sources.error && <ErrorNotice message={sources.error}/>}
      {lecturers.error && <ErrorNotice message={lecturers.error}/>}
      <p>Refresh the page to load authorized equipment and approval options again.</p>
    </section>;
  if (!sources.data || !lecturers.data) return <div role="status" className="grid gap-3">
    <p>Loading available equipment…</p><Skeleton className="h-80 w-full rounded-xl"/>
  </div>;

  if (success) return (
    <section className="request-complete" aria-labelledby="request-complete-title">
      <div className="request-complete-banner">
        <div className="request-complete-icon" aria-hidden="true"><Check className="size-9" /></div>
        <div className="request-complete-intro" role="status">
          <span className="request-complete-kicker"><CheckCircle2 className="size-4" /> Successfully submitted</span>
          <h2 id="request-complete-title">Request submitted successfully</h2>
          <p>Your equipment request has been recorded. You can follow its progress in My Requests.</p>
        </div>
        <div className="request-complete-status" aria-label="Request status">
          <span>Current status</span>
          <strong><CheckCircle2 className="size-4" /> Submitted</strong>
          <small>{selected.length} equipment {selected.length === 1 ? 'type' : 'types'}</small>
        </div>
      </div>
      <div className="request-complete-progress"><RequestProgress current={3}/></div>
      <div className="request-complete-body">
        <div className="request-complete-primary">
          <div className="request-complete-section-title">
            <div><span className="request-complete-eyebrow">REQUEST OVERVIEW</span><h3>Submission summary</h3></div>
            <span className="request-complete-count">{selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'}</span>
          </div>
          <dl className="request-complete-facts">
            <div className="request-complete-purpose"><dt>Purpose</dt><dd>{purpose}</dd></div>
            <div><dt><CalendarDays className="size-4" /> Collection</dt><dd>{new Date(dateStart).toLocaleString()}</dd></div>
            <div><dt><Clock3 className="size-4" /> Expected return</dt><dd>{new Date(dateEnd).toLocaleString()}</dd></div>
            <div><dt><ShieldCheck className="size-4" /> Approval route</dt><dd>{approvalRequirement}</dd></div>
          </dl>
          <div className="request-complete-items">
            <h4><Package className="size-4" /> Requested equipment</h4>
            <ul>{selectedRows.map(({itemId, quantity, item}) =>
              <li key={itemId}><span className="request-complete-item-icon"><Package className="size-4" /></span>
                <span className="request-complete-item-name">{item?.title ?? 'Equipment'}</span>
                <span className="request-complete-item-quantity">{quantity} {item?.uom ?? 'units'}</span>
              </li>
            )}</ul>
          </div>
        </div>
        <aside className="request-complete-next" aria-labelledby="request-next-title">
          <span className="request-complete-eyebrow">NEXT STEPS</span>
          <h3 id="request-next-title">What happens next?</h3>
          <ol className="request-complete-timeline">
            <li className="is-complete"><span className="request-complete-timeline-mark"><Check className="size-4" /></span>
              <div><strong>Request submitted</strong><p>Your equipment list and borrowing details were received.</p></div>
            </li>
            <li><span className="request-complete-timeline-mark">2</span>
              <div><strong>Review and processing</strong><p>Any required academic approvals will appear in your request status.</p></div>
            </li>
            <li><span className="request-complete-timeline-mark">3</span>
              <div><strong>Ready for collection</strong><p>Check the request status before collecting equipment.</p></div>
            </li>
          </ol>
          <div className="request-complete-track"><ClipboardList className="size-5" aria-hidden="true" />
            <p>Track the request in <strong>My Requests</strong>.</p></div>
        </aside>
      </div>
      <div className="request-complete-actions">
        <Button asChild className="request-complete-primary-action">
          <Link href="/borrowing?view=requests"><ClipboardList className="size-4" /> View my requests <ArrowRight className="size-4" /></Link>
        </Button>
        <Button type="button" variant="outline" onClick={reset}><Plus className="size-4" /> Create another request</Button>
      </div>
    </section>
  );

  return <Card className={'request-wizard request-wizard-full '+(student?'request-wizard-student':'')}>
    <CardHeader className="request-wizard-heading">
      <p className="request-wizard-eyebrow">BORROWING REQUEST</p>
      <div className="request-wizard-title-row">
        <div>
          <CardTitle>{draft?.predecessorId ? 'Revise borrowing request' : 'New borrowing request'}</CardTitle>
          <CardDescription>Complete the steps below to submit your equipment request.</CardDescription>
        </div>
        <span className="request-wizard-step-count">Step {step + 1} of 3</span>
      </div>
      <RequestProgress current={step} />
    </CardHeader>
    <CardContent className="request-wizard-content">
       {draft?.predecessorId && <p className="request-wizard-context">This corrects an earlier request. Its previous decisions remain in the history.</p>}
      {message && <Alert variant="destructive" className="mb-4"><AlertTitle>Request not completed</AlertTitle>
        <AlertDescription>{message}</AlertDescription></Alert>}
      {uncertain && <Alert className="mb-4"><AlertTitle>Checking an uncertain result</AlertTitle>
        <AlertDescription>Do not change the request details. Use Retry submission to recover the result with the same command.</AlertDescription>
      </Alert>}

      {step===0 && <section aria-labelledby="wizard-equipment-heading" className="request-wizard-panel">
        <div className="request-wizard-panel-title">
          <div>
            <h3 id="wizard-equipment-heading">Select equipment</h3>
            <p>Find equipment, choose a quantity, and review your selection.</p>
          </div>
          <span className="borrow-section-count">{selected.length} of 20 types selected</span>
        </div>
        <div className="request-wizard-layout">
          <section className="request-wizard-list-panel" aria-label="Available equipment">
            <div className="request-wizard-search">
              <div className="request-wizard-search-field">
                <Search className="size-4" aria-hidden="true"/>
                <Input aria-label="Search equipment" placeholder="Search equipment by name"
                  value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select aria-label="Equipment type" value={kind} onChange={e => setKind(e.target.value)}>
                <option value="ALL">All equipment</option>
                <option value="RETURNABLE">Returnable</option>
                <option value="CONSUMABLE">Consumables</option>
              </select>
            </div>
            <div className="borrow-equipment-table-head" aria-hidden="true">
              <span>Equipment</span><span>Availability</span><span>Approval</span><span>Quantity</span>
            </div>
            <div className="request-wizard-item-list">
              {matching.map(item => {
                const chosen = selected.find(row => row.itemId === item.id);
                return <article className={'request-wizard-item ' + (chosen ? 'is-selected' : '')} key={item.id}>
                  <div className="request-wizard-item-main">
                    <strong>{item.title}</strong>
                    <span className="borrow-equipment-kind">{item.kind === 'RETURNABLE' ? 'Returnable equipment' : 'Consumable'}</span>
                  </div>
                  <div className="borrow-equipment-availability">
                    <span className={'borrow-equipment-stock ' + (item.available > 0 ? 'is-in-stock' : 'is-out-of-stock')}>
                      {item.available > 0 ? 'Available' : 'Unavailable'}
                    </span>
                    <small>{item.available > 0 ? 'Up to ' + item.available + ' ' + item.uom : 'No units available'}</small>
                  </div>
                  <div className="borrow-equipment-approval">{approvalPath(item.policy)}</div>
                  <div className="borrow-equipment-control">
                    {chosen ?
                      <div className="request-wizard-quantity" aria-label={item.title + ' quantity'}>
                        <Button type="button" variant="outline" size="icon" aria-label={'Decrease ' + item.title + ' quantity'}
                          disabled={busy || Boolean(uncertain)} onClick={() => updateSelection(item.id, chosen.quantity - 1)}>
                          <Minus className="size-4"/>
                        </Button>
                        <output aria-live="polite">{chosen.quantity}</output>
                        <Button type="button" variant="outline" size="icon" aria-label={'Increase ' + item.title + ' quantity'}
                          disabled={busy || Boolean(uncertain) || chosen.quantity >= item.available}
                          onClick={() => updateSelection(item.id, chosen.quantity + 1)}>
                          <Plus className="size-4"/>
                        </Button>
                      </div> :
                      <Button type="button" variant="outline" className="request-wizard-add-button"
                        disabled={busy || Boolean(uncertain) || item.available <= 0 || selected.length >= 20}
                        onClick={() => updateSelection(item.id, 1)}>
                        Add
                      </Button>
                    }
                  </div>
                </article>;
              })}
              {!matching.length && <div className="request-wizard-empty">
                No equipment matches your search.
              </div>}
            </div>
          </section>
          <aside className="request-wizard-cart" aria-label="Selected equipment">
            <div className="request-wizard-cart-title">
              <div><h4>Selected equipment</h4><span>{selected.length} {selected.length === 1 ? 'type' : 'types'}</span></div>
              <span className="borrow-cart-unit-count">{selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'}</span>
            </div>
            {selectedRows.length ? <ul>{selectedRows.map(({itemId, quantity, item}) =>
              <li key={itemId}>
                <div><strong>{item?.title ?? 'Equipment'}</strong><span>{quantity} {item?.uom ?? 'units'}</span></div>
                <Button type="button" size="icon" variant="ghost" aria-label={'Remove ' + (item?.title ?? 'equipment')}
                  disabled={busy || Boolean(uncertain)} onClick={() => updateSelection(itemId, 0)}>
                  <Trash2 className="size-4"/>
                </Button>
              </li>
            )}</ul> :
              <div className="request-wizard-cart-empty"><strong>No equipment selected</strong>
                <span>Use Add in the equipment list to begin.</span></div>}
            <div className="borrow-cart-footer"><span>Total requested</span><strong>{selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'}</strong></div>
          </aside>
        </div>
        {selected.length > 0 && !resolved && <Alert variant="destructive" className="mt-4">
          <AlertTitle>Selection needs attention</AlertTitle>
          <AlertDescription>Check available quantities and lecturer coverage for the selected equipment.</AlertDescription>
        </Alert>}
      </section>}

      {step===1 && <section aria-labelledby="wizard-details-heading" className="request-wizard-panel request-wizard-details">
        <div className="request-wizard-panel-title">
          <div><h3 id="wizard-details-heading">Borrowing details</h3>
            <p>Enter the intended use and borrowing period.</p></div>
        </div>
        <div className="request-details-layout">
          <div className="request-details-form">
            <div className="request-details-field">
              <label htmlFor="wizard-purpose">{student ? 'Academic purpose' : 'Borrowing purpose'} <span aria-hidden="true">*</span></label>
              <Textarea id="wizard-purpose" maxLength={1000} rows={4} value={purpose}
                placeholder="Describe the experiment, project, or intended use"
                onChange={e => { setPurpose(e.target.value); setSubmissionDraft(null); }}/>
            </div>
            <div className="request-wizard-date-grid">
              <div><label htmlFor="wizard-collect">Collection date & time</label>
                <Input id="wizard-collect" type="datetime-local" value={collectAt}
                  onChange={e => { setCollectAt(e.target.value); setSubmissionDraft(null); }}/></div>
              <div><label htmlFor="wizard-return">Expected return date & time</label>
                <Input id="wizard-return" type="datetime-local" value={returnAt}
                  onChange={e => { setReturnAt(e.target.value); setSubmissionDraft(null); }}/></div>
            </div>
            {needsLecturer && <div className="request-wizard-lecturer">
              <label htmlFor="wizard-lecturer">Approving lecturer</label>
              <select id="wizard-lecturer" value={chosenLecturer}
                onChange={e => { setLecturerId(e.target.value); setSubmissionDraft(null); }}>
                <option value="">Select a lecturer</option>
                {resolved?.eligible.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
              </select>
            </div>}
            {!resolved && <Alert variant="destructive">
              <AlertTitle>Review equipment selection</AlertTitle>
              <AlertDescription>Return to Equipment to adjust quantities or items.</AlertDescription>
            </Alert>}
            {resolved && !detailsValid && <p className="request-wizard-validation">
              Enter a purpose, a future collection date, a later return date{needsLecturer ? ', and a lecturer' : ''}.
            </p>}
          </div>
          <aside className="request-details-aside" aria-label="Request overview">
            <h4>Request overview</h4>
            <div className="request-details-summary-number">{selected.length} <small>equipment {selected.length === 1 ? 'type' : 'types'}</small></div>
            <ul>{selectedRows.map(({itemId, item, quantity}) =>
              <li key={itemId}><span>{item?.title ?? 'Equipment'}</span><strong>{quantity} {item?.uom ?? 'units'}</strong></li>)}</ul>
            <div className="request-details-summary-foot"><span>Required approval</span><strong>{approvalRequirement}</strong></div>
          </aside>
        </div>
      </section>}

      {step===2 && <section aria-labelledby="wizard-review-heading" className="request-wizard-panel request-wizard-review">
        <div className="request-wizard-panel-title">
          <div><h3 id="wizard-review-heading">Review your request</h3>
            <p>Confirm the equipment, purpose and dates before submission.</p></div>
          <span className="borrow-review-ready"><Check className="size-4" /> Ready to submit</span>
        </div>
        <div className="borrow-review-sheet">
          <div className="borrow-review-sheet-head">
            <h4>Request information</h4>
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>Edit details</Button>
          </div>
          <dl className="borrow-review-facts">
            <div className="is-purpose"><dt>Purpose</dt><dd>{purpose}</dd></div>
            <div><dt>Collection</dt><dd>{new Date(dateStart).toLocaleString()}</dd></div>
            <div><dt>Expected return</dt><dd>{new Date(dateEnd).toLocaleString()}</dd></div>
            <div><dt>Required approval</dt><dd>{approvalRequirement}</dd></div>
            {needsLecturer && <div><dt>Approving lecturer</dt>
              <dd>{resolved?.eligible.find(person => person.id === chosenLecturer)?.displayName ?? 'Not selected'}</dd>
            </div>}
          </dl>
          <div className="borrow-review-sheet-head borrow-review-equipment-head">
            <h4>Equipment <span>({selected.length} {selected.length === 1 ? 'type' : 'types'})</span></h4>
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>Edit equipment</Button>
          </div>
          <div className="borrow-review-table" role="table" aria-label="Requested equipment">
            <div className="borrow-review-table-head" role="row"><span role="columnheader">Equipment</span>
              <span role="columnheader">Type</span><span role="columnheader">Quantity</span></div>
            {selectedRows.map(({itemId, item, quantity}) =>
              <div className="borrow-review-item" role="row" key={itemId}>
                <strong role="cell">{item?.title ?? 'Equipment'}</strong>
                <span role="cell">{item?.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'}</span>
                <span role="cell">{quantity} {item?.uom ?? 'units'}</span>
              </div>)}
            <div className="borrow-review-total"><span>Total requested</span><strong>{selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'}</strong></div>
          </div>
        </div>
      </section>}
    </CardContent>
    <CardFooter className="request-wizard-footer">
      <div className="request-wizard-footer-caption">{'Step '+(step+1)+' of 3'}</div>
      <div className="request-wizard-footer-actions">
        {step>0 && <Button variant="outline" type="button" disabled={busy||Boolean(uncertain)}
          onClick={()=>setStep(step-1)}><ArrowLeft className="size-4"/>Back</Button>}
        {step===0 && <Button variant="ghost" type="button" disabled={busy||Boolean(uncertain)}
          onClick={reset}>Clear selection</Button>}
        {step<2 ? <Button type="button" disabled={busy||Boolean(uncertain)||!selected.length||(step===1&&(!resolved||!detailsValid))}
          onClick={()=>{setMessage('');setStep(step+1);}}>
          {step===0?'Continue to details':'Review request'}<ArrowRight className="size-4"/>
        </Button>:
        <Button type="button" disabled={busy||(!uncertain&&(!resolved||!detailsValid))}
          onClick={submitRequest}>
          <CheckCircle2 className="size-4"/>{busy?'Submitting…':uncertain?'Retry submission':'Submit request'}
        </Button>}
      </div>
    </CardFooter>
  </Card>;
}
