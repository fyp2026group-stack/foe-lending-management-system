'use client';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorNotice } from '@/components/identity/session';
import type { Session } from '@/components/identity/api';
import { useInventoryLookup } from './lookups';
import { MutationForm, TextField } from './inventory';
import { stockLabel } from './catalogue-model';
import type { Item, Stock, Adjustment, Named } from './api';

export function OfficerStockActions({session,items,labs,locations,revision,onSaved}:{
 session:Session;items:Item[];labs:Named[];locations:Named[];revision:number;onSaved:()=>void;
}) {
 const stock=useInventoryLookup<Stock>('stock',revision);
 const proposals=useInventoryLookup<Adjustment>('adjustments',revision);
 const [query,setQuery]=useState('');
 const [choice,setChoice]=useState<{id:string;mode:'identify'|'correct'}|null>(null);
 const rows=useMemo(()=> (stock.data?.items??[]).filter(s=>{
   const name=items.find(i=>i.id===s.itemId)?.name??'';
   const location=locations.find(l=>l.id===s.locationId)?.name??'';
   return (name+' '+location).toLowerCase().includes(query.toLowerCase());
 }),[stock.data,items,locations,query]);
 const selected=stock.data?.items.find(s=>s.id===choice?.id);
 const item=items.find(i=>i.id===selected?.itemId);
 const submitted=()=>{setChoice(null);onSaved();};
 const payload=selected?{itemId:selected.itemId,labId:selected.labId,
   locationId:selected.locationId,expectedVersion:selected.version}:null;
 const eligible=(s:Stock)=>s.state==='AVAILABLE'&&!s.assetId;
 const pending=proposals.data?.items.filter(p=>p.state==='PENDING')??[];
 return <div className="officer-stock-focus">
  <div className="stock-focus-intro">
   <p><strong>Need to identify a unit?</strong> Choose a returnable item and register its serial number if present. The system creates a permanent internal asset ID without adding to stock.</p>
   <p><strong>Stock count incorrect?</strong> Submit a correction with a reason. A different authorized person must approve it.</p>
  </div>
  {stock.error&&<ErrorNotice message={stock.error}/>}
  {proposals.error&&<ErrorNotice message={proposals.error}/>}
  <div className="stock-focus-toolbar">
   <label htmlFor="stock-lookup">Find equipment or location</label>
   <Input id="stock-lookup" value={query} onChange={e=>setQuery(e.target.value)}
     placeholder="Search multimeters, store room…" />
  </div>
  {!stock.data&&!stock.error&&<p role="status">Loading your laboratory stock…</p>}
  <div className="stock-focus-table">
   <Table>
    <TableHeader><TableRow>
     <TableHead>Equipment</TableHead><TableHead>Location</TableHead>
     <TableHead>Condition</TableHead><TableHead>Available units</TableHead><TableHead>Action</TableHead>
    </TableRow></TableHeader>
    <TableBody>{rows.map(row=>{
     const kind=items.find(i=>i.id===row.itemId)?.kind;
     return <TableRow key={row.id} data-state={choice?.id===row.id?'selected':undefined}>
      <TableCell className="font-medium">{items.find(i=>i.id===row.itemId)?.name??'Equipment'}</TableCell>
      <TableCell>{labs.find(l=>l.id===row.labId)?.name??'Assigned laboratory'} · {locations.find(l=>l.id===row.locationId)?.name??'Store'}</TableCell>
      <TableCell><Badge variant="secondary">{stockLabel(row.state)}</Badge></TableCell>
      <TableCell className="tabular-nums">{row.quantity}</TableCell>
      <TableCell><div className="stock-row-actions">
       {eligible(row)&&kind==='RETURNABLE'&&
        <Button size="sm" variant="outline" onClick={()=>setChoice({id:row.id,mode:'identify'})}>Identify unit</Button>}
       {eligible(row)&&<Button size="sm" variant="outline" onClick={()=>setChoice({id:row.id,mode:'correct'})}>Correct count</Button>}
      </div></TableCell>
     </TableRow>;
    })}</TableBody>
   </Table>
   {stock.data&&!rows.length&&<p className="stock-focus-empty">No matching stock records. Clear the search to view other locations.</p>}
  </div>
  {selected&&item&&payload&&choice&&<section key={selected.id+selected.version+choice.mode} className="stock-focus-form">
   <div className="stock-focus-form-header">
    <div><p className="stock-focus-kicker">{choice.mode==='identify'?'INDIVIDUAL UNIT':'STOCK CORRECTION'}</p>
     <h3>{item.name}</h3><p>{locations.find(l=>l.id===selected.locationId)?.name??'Stock location'} · {selected.quantity} available</p>
    </div><Button variant="ghost" size="sm" onClick={()=>setChoice(null)}>Cancel</Button>
   </div>
   {choice.mode==='identify'?
    <MutationForm session={session} path="assets" title="Identify unit" onSaved={submitted}
     context={<p>One existing available unit will receive its permanent internal ID. Stock quantity does not change.</p>}
     build={d=>({...payload,...(String(d.get('serial')??'').trim()?{serial:String(d.get('serial')).trim()}: {})})}>
     <p className="stock-form-help">The manufacturer serial is optional. The system generates an internal ID automatically.</p>
     <TextField name="serial" label="Manufacturer serial / reference (optional)" required={false}/>
    </MutationForm>:
    <MutationForm session={session} path="adjustments" title="Submit correction" onSaved={submitted}
     context={<p>Only the unassigned Available quantity is affected after independent approval.</p>}
     build={d=>({...payload,quantity:Number(d.get('quantity')),direction:d.get('direction'),reason:d.get('reason')})}>
     <p className="stock-form-help">This submits a proposed correction. It will not change the quantity until independently approved.</p>
     <div className="stock-correction-fields">
      <TextField name="quantity" label="Units to correct" type="number"/>
      <div><label htmlFor="correction-direction">Adjustment</label>
       <select id="correction-direction" name="direction" required className="min-h-11 w-full border rounded-md bg-white px-3">
        <option value="REMOVE">Remove missing units</option><option value="ADD">Add unrecorded units</option>
       </select></div>
     </div>
     <TextField name="reason" label="Reason for the correction"/>
    </MutationForm>}
  </section>}
  {pending.length>0&&<section className="stock-pending">
   <h3>Corrections awaiting review <Badge variant="secondary">{pending.length}</Badge></h3>
   {pending.map(p=><p key={p.id}>{items.find(i=>i.id===p.itemId)?.name??'Equipment'} · {p.direction==='ADD'?'+':'−'}{p.quantity} · {p.reason}</p>)}
   <small>A separate authorized reviewer must approve these changes.</small>
  </section>}
 </div>;
}
