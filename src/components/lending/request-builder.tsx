'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCheck,
  Minus, Package, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
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

const stepNames = ['Choose equipment', 'Request details', 'Review & submit'] as const;
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

  if (success) return <Card className="request-wizard-success" role="status">
    <CheckCircle2 className="size-12 text-emerald-700" aria-hidden="true"/>
    <CardTitle>Borrowing request submitted</CardTitle>
    <CardDescription>Your request has been sent for the required approvals.
      You can follow its progress in My Requests.</CardDescription>
    <Button onClick={reset} variant="outline">Create another request</Button>
  </Card>;

  return <Card className={'request-wizard request-wizard-full '+(student?'request-wizard-student':'')}>
    <CardHeader className="request-wizard-heading">
      <p className="request-wizard-eyebrow">EQUIPMENT LENDING</p>
      <div className="request-wizard-title-row">
        <div><CardTitle>{draft?.predecessorId?'Correct borrowing request':'New borrowing request'}</CardTitle>
          <CardDescription>Choose equipment, enter your borrowing details, and submit one request.</CardDescription></div>
        {selected.length>0 && <Badge variant="secondary">{selected.length} {selected.length===1?'item':'items'}</Badge>}
      </div>
    </CardHeader>
    <CardContent className="request-wizard-content">
      <ol className="request-wizard-progress" aria-label="Borrowing request progress">
        {stepNames.map((name,index)=><li key={name}
          className={index===step?'is-current':index<step?'is-done':''}
          aria-current={index===step?'step':undefined}>
          <span className="request-wizard-progress-dot">{index<step?<Check className="size-4" aria-hidden="true"/>:index+1}</span>
          <span>{name}</span>
        </li>)}
      </ol>
      {draft?.predecessorId && <p className="request-wizard-context">This corrects an earlier request. Its previous decisions remain in the history.</p>}
      {message && <Alert variant="destructive" className="mb-4"><AlertTitle>Request not completed</AlertTitle>
        <AlertDescription>{message}</AlertDescription></Alert>}
      {uncertain && <Alert className="mb-4"><AlertTitle>Checking an uncertain result</AlertTitle>
        <AlertDescription>Do not change the request details. Use Retry submission to recover the result with the same command.</AlertDescription>
      </Alert>}

      {step===0 && <section aria-labelledby="wizard-equipment-heading" className="request-wizard-panel">
        <div className="request-wizard-panel-title">
          <div><h3 id="wizard-equipment-heading">Choose equipment</h3>
            <p>Search by name and add the quantities you need.</p></div>
          <Badge variant="outline">{selected.length} / 20 types</Badge>
        </div>
        <div className="request-wizard-layout">
          <div className="request-wizard-list-panel">
            <div className="request-wizard-search">
              <Search className="size-4" aria-hidden="true"/>
              <Input aria-label="Search equipment" placeholder="Search multimeter, Arduino, oscilloscope…"
                value={search} onChange={e=>setSearch(e.target.value)} />
              <select aria-label="Equipment type" value={kind} onChange={e=>setKind(e.target.value)}>
                <option value="ALL">All equipment</option><option value="RETURNABLE">Returnable</option>
                <option value="CONSUMABLE">Consumables</option>
              </select>
            </div>
            <div className="request-wizard-item-list">
              {matching.map(item=>{
                const chosen=selected.find(row=>row.itemId===item.id);
                return <article className={'request-wizard-item '+(chosen?'is-selected':'')} key={item.id}>
                  <div className="request-wizard-item-icon"><Package className="size-5" aria-hidden="true"/></div>
                  <div className="request-wizard-item-main">
                    <strong>{item.title}</strong>
                    <div className="request-wizard-item-meta">
                      <Badge variant="secondary">{item.kind==='RETURNABLE'?'Returnable':'Consumable'}</Badge>
                      <span>{item.available>0?'Up to '+item.available+' '+item.uom+' available':'Currently unavailable'}</span>
                      <span>{approvalPath(item.policy)}</span>
                    </div>
                  </div>
                  {chosen ?
                    <div className="request-wizard-quantity" aria-label={item.title+' quantity'}>
                      <Button type="button" variant="ghost" size="icon" aria-label={'Decrease '+item.title+' quantity'}
                        disabled={busy||Boolean(uncertain)}
                        onClick={()=>updateSelection(item.id,chosen.quantity-1)}><Minus/></Button>
                      <output aria-live="polite">{chosen.quantity}</output>
                      <Button type="button" variant="ghost" size="icon" aria-label={'Increase '+item.title+' quantity'}
                        disabled={busy||Boolean(uncertain)||chosen.quantity>=item.available}
                        onClick={()=>updateSelection(item.id,chosen.quantity+1)}><Plus/></Button>
                    </div> :
                    <Button type="button" disabled={busy||Boolean(uncertain)||item.available<=0||selected.length>=20}
                      onClick={()=>updateSelection(item.id,1)}><Plus className="size-4"/>Add</Button>}
                </article>;
              })}
              {!matching.length && <div className="request-wizard-empty">
                No matching equipment. Try another name or equipment type.</div>}
            </div>
          </div>
          <aside className="request-wizard-cart" aria-label="Selected equipment">
            <div className="request-wizard-cart-title"><h4>Your selection</h4>
              <Badge variant="outline">{selectedQuantity} {selectedQuantity===1?'unit':'units'}</Badge></div>
            {selectedRows.length ? <ul>{selectedRows.map(({itemId,quantity,item})=>
              <li key={itemId}><div><strong>{item?.title??'Equipment'}</strong>
                <span>{quantity} {item?.uom??'units'} · {item?.kind==='CONSUMABLE'?'Consumable':'Returnable'}</span></div>
                <Button type="button" size="icon" variant="ghost" aria-label={'Remove '+(item?.title??'equipment')}
                  disabled={busy||Boolean(uncertain)} onClick={()=>updateSelection(itemId,0)}><Trash2/></Button>
              </li>)}</ul> :
              <p className="request-wizard-cart-empty">Equipment you add will appear here.</p>}
            <p className="request-wizard-cart-note">One request for all selected equipment.</p>
          </aside>
        </div>
        {selected.length>0 && !resolved && <Alert variant="destructive" className="mt-4">
          <AlertTitle>Selection needs attention</AlertTitle>
          <AlertDescription>Check quantities and availability. Items requiring lecturer approval must have a common eligible lecturer.</AlertDescription>
        </Alert>}
      </section>}

      {step===1 && <section aria-labelledby="wizard-details-heading" className="request-wizard-panel request-wizard-details">
        <div className="request-wizard-panel-title"><div>
          <h3 id="wizard-details-heading">Request details</h3>
          <p>Tell the laboratory what you need the equipment for and when.</p>
        </div></div>
        <label htmlFor="wizard-purpose">{student?'Academic purpose':'Borrowing purpose'} <span aria-hidden="true">*</span></label>
        <Textarea id="wizard-purpose" maxLength={1000} rows={4} value={purpose}
          placeholder="Describe your laboratory experiment, project or intended use…"
          onChange={e=>{setPurpose(e.target.value);setSubmissionDraft(null);}}/>
        <div className="request-wizard-date-grid">
          <div><label htmlFor="wizard-collect">Collection date & time</label>
            <Input id="wizard-collect" type="datetime-local" value={collectAt}
              onChange={e=>{setCollectAt(e.target.value);setSubmissionDraft(null);}}/></div>
          <div><label htmlFor="wizard-return">Expected return date & time</label>
            <Input id="wizard-return" type="datetime-local" value={returnAt}
              onChange={e=>{setReturnAt(e.target.value);setSubmissionDraft(null);}}/></div>
        </div>
        {!resolved && <Alert variant="destructive"><AlertTitle>Review your equipment selection</AlertTitle><AlertDescription>Adjust quantities or change equipment to match available stock and approval coverage.</AlertDescription></Alert>}
        {needsLecturer && <div className="request-wizard-lecturer">
          <label htmlFor="wizard-lecturer">Approving lecturer</label>
          <select id="wizard-lecturer" value={chosenLecturer}
            onChange={e=>{setLecturerId(e.target.value);setSubmissionDraft(null);}}>
            <option value="">Select eligible lecturer</option>
            {resolved?.eligible.map(person=><option value={person.id} key={person.id}>{person.displayName}</option>)}
          </select>

        </div>}

        {resolved && !detailsValid && <p className="request-wizard-validation">
          Enter a purpose, choose a future collection date, and select a later return date{needsLecturer?' and an eligible lecturer':''}.
        </p>}
      </section>}

      {step===2 && <section aria-labelledby="wizard-review-heading" className="request-wizard-panel request-wizard-review">
        <div className="request-wizard-panel-title"><div><h3 id="wizard-review-heading">Review your request</h3>
          <p>Check everything before sending it to the laboratory.</p></div></div>
        <div className="request-wizard-review-grid">
          <section><h4><ClipboardCheck className="size-4" aria-hidden="true"/>Request details</h4>
            <dl><div><dt>Purpose</dt><dd>{purpose}</dd></div>
              <div><dt>Collection</dt><dd>{new Date(dateStart).toLocaleString()}</dd></div>
              <div><dt>Expected return</dt><dd>{new Date(dateEnd).toLocaleString()}</dd></div>
              {needsLecturer && <div><dt>Approving lecturer</dt>
                <dd>{resolved?.eligible.find(person=>person.id===chosenLecturer)?.displayName??'Not selected'}</dd></div>}
            </dl>
          </section>
          <section><h4><Package className="size-4" aria-hidden="true"/>Equipment ({selected.length})</h4>
            <ul>{selectedRows.map(({itemId,quantity,item})=><li key={itemId}>
              <span>{item?.title??'Equipment'}</span><strong>{quantity} {item?.uom??'units'}</strong></li>)}</ul>
          </section>
        </div>
        <div className="request-wizard-approval-summary"><ShieldCheck className="size-5" aria-hidden="true"/><span>Required approval: <strong>{approvalRequirement}</strong></span></div>
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
