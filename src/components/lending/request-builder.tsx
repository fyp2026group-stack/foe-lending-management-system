'use client';
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Search, Trash2 } from 'lucide-react';
import type { Session } from '@/components/identity/api';
import { ApiError } from '@/components/identity/api';
import { lendingWrite, type BorrowDraft, type Lecturer, type LendingSource } from './api';
import { useLendingChoices } from './shared';
import { CommandReplay, draftSavePayload, draftSubmitPayload } from './lifecycle-model';
import { quantityLimit } from './request-options';
import { basketKey, readSelection } from './student-model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Pick = { itemId: string; quantity: number };
const approval = (p: string) => p === 'LECTURER' || p === 'BOTH';
const hodApproval = (p: string) => p === 'HOD' || p === 'BOTH';
const dateLocal = (value?: string) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export function RequestBuilder({ session, revision, refresh, draft }: {
  session: Session; revision: number; refresh: () => void; draft?: BorrowDraft;
}) {
  const sources = useLendingChoices<LendingSource>('sources', revision);
  const lecturers = useLendingChoices<Lecturer>('lecturers', revision);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Pick[]>(() =>
    draft?.payload.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity })) ?? (() => { try {return readSelection(sessionStorage.getItem(basketKey(session.user.id))).map(l=>({itemId:l.itemId,quantity:l.quantity}));}catch{return [];} })());
  const [purpose, setPurpose] = useState(draft?.payload.purpose ?? '');
  const [collectAt, setCollectAt] = useState(dateLocal(draft?.payload.collectAt));
  const [returnAt, setReturnAt] = useState(dateLocal(draft?.payload.returnAt));
  const [lecturerId, setLecturerId] = useState(draft?.payload.lecturerId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const replay = useRef(new CommandReplay());
  const pendingDraft = useRef<BorrowDraft | undefined>(draft);

  const catalogue = useMemo(() => {
    const grouped = new Map<string, LendingSource[]>();
    for (const source of sources.data?.items ?? []) grouped.set(source.itemId, [...(grouped.get(source.itemId) ?? []), source]);
    return [...grouped.entries()].map(([itemId, available]) => ({
      itemId, name: available[0].item, kind: available[0].kind, uom: available[0].uom,
      available, stock: available.reduce((sum, s) => sum + s.availableQuantity, 0),
      limit: Math.max(...available.map(s => Math.min(s.availableQuantity, quantityLimit(s)))),
      policy: available[0].policy
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sources.data]);
  const selected = picks.map(pick => ({ pick, item: catalogue.find(i => i.itemId === pick.itemId) }))
    .filter((entry): entry is {pick: Pick; item: (typeof catalogue)[number]} => Boolean(entry.item));
  const lecturerNeeded = selected.some(({item}) => approval(item.policy));
  const hodNeeded = selected.some(({item}) => hodApproval(item.policy));
  const selectedLabs = selected.filter(({item}) => approval(item.policy))
    .map(({item,pick}) => item.available.filter(s=>s.availableQuantity>=pick.quantity).sort((a,b)=>b.availableQuantity-a.availableQuantity)[0]?.labId).filter((lab):lab is string=>Boolean(lab));
  const eligible = (lecturers.data?.items ?? []).filter(l => l.id !== session.user.id &&
    selectedLabs.every(lab => l.labIds.includes(lab)));
  const chosenLecturer = eligible.some(l => l.id === lecturerId) ? lecturerId : '';
  const itemsValid = picks.length > 0 && picks.length === selected.length &&
    selected.every(({pick,item}) => Number.isInteger(pick.quantity) && pick.quantity >= 1 && pick.quantity <= item.limit);
  const datesValid = !!collectAt && !!returnAt && new Date(collectAt).getTime() > Date.now() &&
    new Date(returnAt).getTime() > new Date(collectAt).getTime();
  const detailsValid = !!purpose.trim() && datesValid && (!lecturerNeeded || !!chosenLecturer);
  const add = (id: string) => {
    setError('');
    setPicks(current => current.some(p => p.itemId === id) ? current : [...current, {itemId:id,quantity:1}]);
  };
  const qty = (id: string, n: number) => setPicks(current =>
    current.map(p => p.itemId === id ? {...p,quantity:n} : p));
  const go = (next: number) => {
    setError('');
    if (next === 1 && !itemsValid) { setError('Select at least one available item and enter a valid quantity.'); return; }
    if (next === 2 && !detailsValid) { setError('Complete the purpose, collection and return dates, and required lecturer.'); return; }
    setStep(next);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  async function issue(path: string, payload: Record<string,unknown>) {
    const command = replay.current.prepare(path, payload);
    try {
      const result = await lendingWrite<{id:string;version:number}>(path,command,session.csrfToken);
      replay.current.resolve();
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) replay.current.resolve();
      throw e;
    }
  }
  async function submit() {
    if (!itemsValid || !detailsValid || busy) return;
    setBusy(true); setError('');
    try {
      // The stock location is assigned internally; the borrower never selects it.
      const lines = selected.map(({pick,item}) => {
        const source = item.available
          .filter(s => s.availableQuantity >= pick.quantity)
          .sort((a,b) => b.availableQuantity - a.availableQuantity)[0];
        if (!source) throw Error('The requested quantity cannot be supplied from one stock source. Reduce the quantity.');
        return { itemId:pick.itemId,labId:source.labId,locationId:source.locationId,quantity:pick.quantity };
      });
      const payload = {purpose:purpose.trim(),collectAt:new Date(collectAt).toISOString(),
        returnAt:new Date(returnAt).toISOString(),...(lecturerNeeded ? {lecturerId:chosenLecturer} : {}),lines};
      if (!pendingDraft.current) {
        const saved = await issue('drafts',draftSavePayload(payload));
        pendingDraft.current = {...saved,payload,cancelled:false,updatedAt:new Date().toISOString()};
      } else if (JSON.stringify(pendingDraft.current.payload) !== JSON.stringify(payload)) {
        const saved = await issue('drafts',draftSavePayload(payload,pendingDraft.current));
        pendingDraft.current = {...saved,payload,cancelled:false,updatedAt:new Date().toISOString()};
      }
      await issue('submit',draftSubmitPayload(pendingDraft.current!));
      pendingDraft.current = undefined;
      try {sessionStorage.removeItem(basketKey(session.user.id));} catch {}
      setComplete(true); refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit this request. Please retry.');
    } finally { setBusy(false); }
  }
  if (sources.error || lecturers.error) return <div role="alert" className="rounded-xl border p-6">{sources.error || lecturers.error}</div>;
  if (!sources.data || !lecturers.data) return <div role="status" className="p-8">Loading available equipment…</div>;
  if (complete) return <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-10 text-center space-y-5">
    <Check className="mx-auto h-12 w-12 text-emerald-600"/>
    <h2 className="text-2xl font-semibold">Request submitted</h2>
    <p>Your request has been sent for the required approvals.</p>
    <Button onClick={() => {setComplete(false);setPicks([]);setPurpose('');setCollectAt('');setReturnAt('');setStep(0);}}>Create another request</Button>
  </section>;
  return <section className="w-full space-y-6 pb-12">
    <div className="grid grid-cols-3 gap-2 rounded-xl border bg-white p-4 sm:p-5" aria-label="Request progress">
      {['Select equipment','Request details','Review & submit'].map((title,i)=>
        <div key={title} className="flex items-center gap-2 sm:gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${step >= i ? 'bg-slate-900 text-white':'bg-slate-100 text-slate-500'}`}>{step > i ? <Check size={17}/> : i+1}</span>
          <span className={`text-xs sm:text-sm ${step===i?'font-semibold':'text-slate-500'}`}>{title}</span>
        </div>)}
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    {step===0 && <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-semibold">Select equipment</h2><p className="text-sm text-slate-500">Add the items and quantities needed for one request.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{picks.length} selected</span>
      </div>
      <div className="relative max-w-xl"><Search size={18} className="absolute left-3 top-3.5 text-slate-400"/><Input aria-label="Search equipment" className="pl-10" placeholder="Search equipment" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="grid gap-3 lg:grid-cols-2">
      {catalogue.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())).map(item=>{
        const pick=picks.find(p=>p.itemId===item.itemId);
        return <article key={item.itemId} className="flex flex-col justify-between gap-4 rounded-xl border bg-white p-5">
          <div><div className="flex justify-between gap-3"><h3 className="font-semibold">{item.name}</h3><span className="text-xs text-slate-500">{item.kind==='CONSUMABLE'?'Consumable':'Returnable'}</span></div>
          <p className="mt-2 text-sm text-slate-500">{item.stock} {item.uom} available</p></div>
          {pick ? <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label={'Decrease '+item.name} disabled={pick.quantity<=1} onClick={()=>qty(item.itemId,pick.quantity-1)}><Minus size={16}/></Button>
            <Input aria-label={'Quantity for '+item.name} type="number" min={1} max={item.limit} className="w-20 text-center" value={pick.quantity} onChange={e=>qty(item.itemId,Number(e.target.value))}/>
            <Button type="button" variant="outline" size="icon" aria-label={'Increase '+item.name} disabled={pick.quantity>=item.limit} onClick={()=>qty(item.itemId,pick.quantity+1)}><Plus size={16}/></Button>
          </div><Button type="button" variant="ghost" aria-label={'Remove '+item.name} onClick={()=>setPicks(current=>current.filter(p=>p.itemId!==item.itemId))}><Trash2 size={17}/></Button></div>
          : <Button type="button" variant="outline" disabled={picks.length>=20 || item.limit<1} onClick={()=>add(item.itemId)}><Plus size={17} className="mr-2"/>Add item</Button>}
        </article>;
      })}</div>
      {!catalogue.length && <p>No equipment is currently available.</p>}
    </div>}
    {step===1 && <div className="mx-auto max-w-3xl space-y-5 rounded-xl border bg-white p-5 sm:p-8">
      <h2 className="text-xl font-semibold">Request details</h2>
      <label className="block space-y-2 text-sm font-medium">Purpose of borrowing<Textarea maxLength={1000} rows={4} value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="Describe the purpose of using this equipment" required/></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium">Collection date and time<Input type="datetime-local" value={collectAt} onChange={e=>setCollectAt(e.target.value)} required/></label>
      <label className="block space-y-2 text-sm font-medium">Expected return date and time<Input type="datetime-local" value={returnAt} onChange={e=>setReturnAt(e.target.value)} required/></label></div>
      {lecturerNeeded && <label className="block space-y-2 text-sm font-medium">Approving lecturer
        <select className="min-h-11 w-full rounded-md border bg-white px-3" value={chosenLecturer} onChange={e=>setLecturerId(e.target.value)}>
          <option value="">Select lecturer</option>{eligible.map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}
        </select>
        {!eligible.length && <p role="alert" className="text-sm font-normal text-red-700">No eligible lecturer covers the selected lecturer-approval items. Contact the laboratory administrator.</p>}
      </label>}
    </div>}
    {step===2 && <div className="mx-auto max-w-3xl space-y-5 rounded-xl border bg-white p-5 sm:p-8">
      <h2 className="text-xl font-semibold">Review your request</h2>
      <div className="divide-y rounded-lg border">{selected.map(({pick,item})=><div key={item.itemId} className="flex justify-between gap-4 p-4"><span>{item.name}</span><strong>{pick.quantity} {item.uom}</strong></div>)}</div>
      <div className="space-y-2 text-sm"><p><strong>Purpose:</strong> {purpose}</p><p><strong>Collection:</strong> {new Date(collectAt).toLocaleString()}</p>
      <p><strong>Return:</strong> {new Date(returnAt).toLocaleString()}</p>
      <p><strong>Approval:</strong> {lecturerNeeded && hodNeeded ? 'Lecturer and HOD' : lecturerNeeded ? 'Lecturer' : hodNeeded ? 'HOD' : 'No approval required'}</p></div>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <Button type="button" variant="outline" disabled={busy || step===0} onClick={()=>go(step-1)}><ChevronLeft size={17} className="mr-1"/>Back</Button>
      {step<2 ? <Button type="button" onClick={()=>go(step+1)} disabled={busy}>Continue<ChevronRight size={17} className="ml-1"/></Button>
      : <Button type="button" disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit request'}</Button>}
    </div>
  </section>;
}
