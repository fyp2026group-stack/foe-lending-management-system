'use client';

import { useEffect, useState } from 'react';
import { Package, Search, SlidersHorizontal, Info, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useLending } from './shared';
import { useSelectedSources } from './selected-sources';
import { type LendingSource } from './api';
import { approvalPath, sourceKey } from './student-model';
import { quantityLimit } from './request-options';
import { selectedBrowserSource, sameSelectedSource, type SourceSelection } from './browser-source-selection';

export type BrowserSource = LendingSource & { category?: string; description?: string; specifications?: Record<string, string> };
export type BrowserSelection = SourceSelection;
type SourcePage = { items: BrowserSource[]; total: number; limit: number; offset: number };

/** One catalogue for every borrower surface; selection metadata lives independently of the current page. */
export function EquipmentBrowser({ selected, onQuantity, onContinue, knownSources = [], disabled = false, revision = 0 }: {
  selected: BrowserSelection[]; onQuantity: (source: BrowserSource, quantity: number) => void;
  onContinue: () => void; knownSources?: BrowserSource[]; disabled?: boolean; revision?: number;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState('');
  const [noApproval, setNoApproval] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detail, setDetail] = useState<BrowserSource>();
  const [retained, setRetained] = useState<Record<string, BrowserSource>>({});
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 200); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  const params = new URLSearchParams({ limit: '20', offset: String(offset), q: debounced });
  if (kind) params.set('kind', kind);
  if (noApproval) params.set('policy', 'NONE');
  const page = useLending<SourcePage>('sources?' + params, revision);
  const hydration = useSelectedSources(selected.map(row => row.itemId), revision);
  const rows = page.data?.items ?? [];
  const sourceFor = (line: BrowserSelection) => selectedBrowserSource(line, knownSources, hydration.data?.items ?? [], Object.values(retained), rows);
  const quantity = (source: BrowserSource) => {
    const line = selected.find(row => row.itemId === source.itemId);
    const chosen = line && sourceFor(line);
    return line && chosen && sameSelectedSource(chosen, source) ? line.quantity : 0;
  };
  function change(source: BrowserSource, value: number) {
    if (disabled) return;
    setRetained(current => ({ ...current, [source.itemId]: source }));
    onQuantity(source, value);
  }
  function stepper(source: BrowserSource) {
    const otherSource = selected.some(line => line.itemId === source.itemId) && !quantity(source);
    const count = quantity(source), maximum = Math.min(quantityLimit(source), source.availableQuantity);
    return count ? <div className="catalogue-stepper" role="group" aria-label={source.item + ' quantity'}>
      <Button variant="ghost" size="icon" disabled={disabled} aria-label={'Decrease ' + source.item} onClick={() => change(source, count - 1)}>−</Button>
      <strong aria-live="polite">{count}</strong>
      <Button variant="ghost" size="icon" disabled={disabled || count >= maximum} aria-label={'Increase ' + source.item} onClick={() => change(source, count + 1)}>+</Button>
    </div> : <Button variant="outline" size="sm" disabled={disabled || otherSource || maximum < 1 || selected.length >= 20} onClick={() => change(source, 1)}>{otherSource ? 'Selected elsewhere' : '+ Add'}</Button>;
  }
  const units = selected.reduce((sum, row) => sum + row.quantity, 0);
  const summary = <div className="catalogue-selection-inner">
    <div className="catalogue-selection-head"><h2>Your request <Badge>{selected.length}</Badge></h2><p aria-live="polite">{selected.length} of 20 equipment types · {units} total units</p></div>
    {selected.length >= 20 && <p className="px-5 pt-3 text-xs" role="status">20 equipment types selected. Remove one to add another.</p>}<ScrollArea className="catalogue-picked-scroll"><div className="catalogue-picked-items">{selected.length ? selected.map(line => {
      const source = sourceFor(line);
      return <div className="catalogue-picked" key={line.itemId}><Package size={20}/><div><strong>{source?.item ?? 'Equipment awaiting availability check'}</strong><small>{source ? `${source.lab} / ${source.location} / ${approvalPath(source.policy)}` : 'Selected source unavailable; remove or review this selection'}{source ? ` / Max ${Math.min(quantityLimit(source), source.availableQuantity)} ${source.uom}` : ''}</small>
        <div className="catalogue-picked-actions">{source ? stepper(source) : <span>{line.quantity} units</span>}<Button variant="ghost" size="icon" disabled={disabled} aria-label={'Remove ' + (source?.item ?? 'equipment')} onClick={() => onQuantity(source ?? { itemId: line.itemId } as BrowserSource, 0)}><Trash2 size={15}/></Button></div></div></div>;
    }) : <div className="catalogue-empty"><Package size={32}/><strong>No equipment selected</strong><p>Choose equipment from the catalogue.<br/>Your request will appear here.</p></div>}</div></ScrollArea>
    <Separator/><div className="catalogue-selection-bottom"><div><span>Items selected</span><strong>{units} units</strong></div><Button disabled={!selected.length || disabled} onClick={onContinue}>Continue to request <ArrowRight size={16}/></Button><p><Info size={14}/> Availability and approval coverage are checked again before submission.</p></div>
  </div>;
  return <div className="catalogue-browser">
    {hydration.error && <p role="alert">{hydration.error}</p>}<div className="catalogue-workspace"><section className="catalogue-panel" aria-label="Equipment catalogue">
      <div className="catalogue-toolbar"><Button variant="outline" className="catalogue-search-launch" onClick={() => setSearchOpen(true)}><Search size={17}/><span>{query || 'Search equipment, category or laboratory'}</span><kbd>Ctrl K</kbd></Button>
        <Popover><PopoverTrigger asChild><Button variant="outline"><SlidersHorizontal size={15}/> Filters</Button></PopoverTrigger><PopoverContent><strong>Availability & approval</strong><p className="text-xs mt-2">Only available equipment with an eligible approval path is listed.</p><label className="catalogue-filter-option"><Checkbox checked={noApproval} onCheckedChange={value => { setNoApproval(value === true); setOffset(0); }}/> No academic approval</label><Button variant="ghost" onClick={() => { setNoApproval(false); setKind(''); setQuery(''); setOffset(0); }}>Reset filters</Button></PopoverContent></Popover>
        <span className="catalogue-result-count" role="status">{page.data ? `${page.data.total} equipment sources` : 'Loading equipment…'}</span></div>
      <div className="catalogue-chips">{[['', 'All equipment'], ['RETURNABLE', 'Returnable'], ['CONSUMABLE', 'Consumables']].map(([value, label]) => <Button size="sm" variant={kind === value ? 'secondary' : 'ghost'} aria-pressed={kind === value} key={value} onClick={() => { setKind(value); setOffset(0); }}>{label}</Button>)}{query && <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setOffset(0); }}>Clear search</Button>}</div>
      {page.error && <p role="alert" className="p-5">{page.error}</p>}
      <Table className="catalogue-table"><TableHeader><TableRow><TableHead>Equipment</TableHead><TableHead>Laboratory</TableHead><TableHead>Available</TableHead><TableHead>Approval</TableHead><TableHead className="text-right">Request</TableHead></TableRow></TableHeader>
        <TableBody>{!page.data && !page.error ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-12 w-full"/></TableCell></TableRow>) : rows.map(source => <TableRow key={sourceKey(source)} data-selected={quantity(source) > 0}>
          <TableCell><div className="catalogue-equipment"><span className="catalogue-equipment-icon"><Package size={20}/></span><div><strong>{source.item}</strong><small>{source.category ?? 'Category unavailable'} · {source.itemId}</small></div></div></TableCell>
          <TableCell><strong>{source.lab}</strong><small>{source.location}</small></TableCell><TableCell><strong className={source.availableQuantity > 0 ? 'catalogue-in-stock' : ''}>{source.availableQuantity} {source.uom}</strong><small>{source.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'}</small></TableCell>
          <TableCell><Badge variant="secondary">{approvalPath(source.policy)}</Badge></TableCell><TableCell><div className="catalogue-row-actions"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label={'Details for ' + source.item} onClick={() => setDetail(source)}><Info size={15}/></Button></TooltipTrigger><TooltipContent>View equipment details</TooltipContent></Tooltip>{stepper(source)}</div></TableCell></TableRow>)}
          {page.data && !rows.length && <TableRow><TableCell colSpan={5}><div className="catalogue-empty"><Package/><strong>No equipment matches</strong><p>Try another search or reset your filters.</p></div></TableCell></TableRow>}</TableBody></Table>
      <div className="catalogue-pagination"><span>{page.data ? `Showing ${rows.length ? offset + 1 : 0}–${offset + rows.length} of ${page.data.total}` : 'Loading'}</span><div><Button size="sm" variant="outline" disabled={!offset || !page.data} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</Button><Button size="sm" variant="outline" disabled={!page.data || offset + rows.length >= page.data.total} onClick={() => setOffset(offset + 20)}>Next</Button></div></div>
    </section><aside className="catalogue-selection catalogue-panel" aria-label="Your selection">{summary}</aside></div>
    <div className="catalogue-mobile-bar"><strong>{selected.length} types · {units} units</strong><Button onClick={() => setMobileOpen(true)}>Review selection</Button></div>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent className="catalogue-selection-sheet"><SheetHeader><SheetTitle>Your selection</SheetTitle><SheetDescription>Review equipment and quantities</SheetDescription></SheetHeader>{summary}</SheetContent></Sheet>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="catalogue-command"><DialogTitle className="sr-only">Search equipment</DialogTitle><DialogDescription className="sr-only">Search the authorized catalogue. Use arrow keys and Enter to open details.</DialogDescription><Command shouldFilter={false}><CommandInput autoFocus placeholder="Search equipment, category, lab…" value={query} onValueChange={value => { setQuery(value.slice(0, 120)); setOffset(0); }}/><CommandList><CommandEmpty>{page.error ?? (!page.data ? 'Searching…' : 'No equipment matches.')}</CommandEmpty>{rows.map(source => <CommandItem key={sourceKey(source)} value={sourceKey(source)} onSelect={() => { setSearchOpen(false); setDetail(source); }}><Package size={18}/><div><strong>{source.item}</strong><small>{source.lab} · {source.category}</small></div><span>{source.availableQuantity} available</span></CommandItem>)}</CommandList></Command><div className="catalogue-command-footer">↑ ↓ Navigate · Enter View details · Esc Close</div></DialogContent></Dialog>
    <Sheet open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(undefined); }}><SheetContent className="catalogue-detail-sheet"><SheetHeader><p className="catalogue-eyebrow">Equipment information</p><SheetTitle>{detail?.item ?? 'Equipment details'}</SheetTitle><SheetDescription>{detail?.category ?? 'Equipment catalogue'}</SheetDescription></SheetHeader>{detail && <ScrollArea className="flex-1 px-6"><p>{detail.description || 'No description provided.'}</p><Separator className="my-6"/><dl className="catalogue-detail-facts">{[['Available', `${detail.availableQuantity} ${detail.uom}`], ['Borrowing type', detail.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'], ['Academic approval', approvalPath(detail.policy)], ['Laboratory', detail.lab], ['Storage location', detail.location], ['Equipment ID', detail.itemId], ...Object.entries(detail.specifications ?? {})].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></ScrollArea>}<div className="p-6 border-t">{detail && stepper(detail)}</div></SheetContent></Sheet>
  </div>;
}
