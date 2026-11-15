'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, Minus, Plus, Package, Search, SlidersHorizontal, ShoppingBasket, X } from 'lucide-react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item, Named } from '@/components/inventory/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentDataTable, type StudentColumn } from './student-data-table';
import { StudentSelect } from './student-controls';
import { useLendingChoices } from './shared';
import { approvalPath, sourceKey, persistStudentSelection } from './student-model';
import { quantityLimit } from './request-options';
import type { LendingSource, DraftPayload } from './api';

// Synthetic catalogue records sometimes contain UUIDs in their display names.
// Keep their real identifiers for operations, but never present these as human-friendly names.
const uuidInName = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function humanLabel(value: string | undefined, fallback: string) {
  const clean = (value ?? '').replace(uuidInName, '').replace(/[-–—:]+\s*$/, '').trim();
  return !clean || /^(equipment|item|category|laboratory|lab)$/i.test(clean) ? fallback : clean;
}
export function StudentBrowse({
  session,
  audience = 'Student workspace',
}: {
  session: Session;
  audience?: string;
}) {
  const router = useRouter();
  const returnFocus = useRef<HTMLButtonElement>(null);
  const sources = useLendingChoices<LendingSource>('sources', 0);
  const catalogue = useInventoryLookup<Item>('items?active=true', 0);
  const categories = useInventoryLookup<Named>('categories', 0);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [lab, setLab] = useState('');
  const [available, setAvailable] = useState('');
  const [kind, setKind] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [basket, setBasket] = useState<DraftPayload['lines']>([]);
  const [notice, setNotice] = useState('');

  const all = sources.data?.items ?? [];
  const items = catalogue.data?.items ?? [];
  const categoryNames = categories.data?.items ?? [];
  const itemFor = (s: LendingSource) => items.find((item) => item.id === s.itemId);
  const itemName = (s: LendingSource) => humanLabel(s.item, 'Unnamed equipment');
  const labName = (s: LendingSource) => humanLabel(s.lab, 'Laboratory not named');
  const categoryFor = (s: LendingSource) =>
    humanLabel(categoryNames.find((value) => value.id === itemFor(s)?.categoryId)?.name, 'Uncategorized');
  const chosen = all.find((source) => sourceKey(source) === selected);
  const filtered = all.filter((source) =>
    (!query || (source.item + ' ' + source.lab + ' ' + source.location).toLowerCase().includes(query.toLowerCase())) &&
    (!category || itemFor(source)?.categoryId === category) &&
    (!lab || source.labId === lab) &&
    (!kind || source.kind === kind) &&
    (!available || (available === 'yes' ? source.availableQuantity > 0 : source.availableQuantity === 0))
  );
  const filterActive = Boolean(query || category || lab || available || kind);

  function resetFilters() {
    setQuery('');
    setCategory('');
    setLab('');
    setAvailable('');
    setKind('');
  }
  function start() {
    try {
      persistStudentSelection(sessionStorage, session.user.id, basket);
      router.push('/borrowing?view=new');
    } catch {
      setNotice('Browser storage is unavailable. Your selection is still on this page; enable storage and try again.');
    }
  }
  function updateBasket(next: DraftPayload['lines']) {
    setBasket(next);
    try {
      persistStudentSelection(sessionStorage, session.user.id, next);
      setNotice('');
    } catch {
      setNotice('Browser storage is unavailable. Your selection remains here until you can start a request.');
    }
  }
  function openDetail(source: LendingSource, button: HTMLButtonElement) {
    returnFocus.current = button;
    setSelected(sourceKey(source));
    setQuantity(basket.find((line) => sourceKey(line) === sourceKey(source))?.quantity ?? 1);
    setNotice('');
  }
  function closeDetail() {
    setSelected('');
    // The dialog restores focus to the originating table action.
  }
  function add(source: LendingSource) {
    const max = Math.min(quantityLimit(source), source.availableQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      setNotice('Choose a quantity within the available stock.');
      return;
    }
    const exists = basket.some((line) => sourceKey(line) === sourceKey(source));
    if (!exists && basket.length >= 20) {
      setNotice('A request supports up to 20 different equipment selections.');
      return;
    }
    updateBasket([
      ...basket.filter((line) => sourceKey(line) !== sourceKey(source)),
      { itemId: source.itemId, labId: source.labId, locationId: source.locationId, quantity },
    ]);
    toast.success('Equipment added to your request');
    closeDetail();
  }

  const columns: StudentColumn<LendingSource>[] = [
    {
      id: 'equipment',
      title: 'Equipment',
      value: (source) => [itemName(source), source.itemId, labName(source), source.location].join(' '),
      cell: (source) => (
        <div className="browse-equipment-name">
          <span className="browse-equipment-icon"><Package size={17} aria-hidden="true" /></span>
          <span><strong>{itemName(source)}</strong><small>{categoryFor(source)}</small>{basket.some((line) => sourceKey(line) === sourceKey(source)) && <em className="browse-equipment-row-selected">Selected</em>}</span>
        </div>
      ),
    },
    {
      id: 'laboratory',
      title: 'Laboratory',
      value: (source) => labName(source),
    },
    {
      id: 'available',
      title: 'Availability',
      value: (source) => source.availableQuantity,
      numeric: true,
      cell: (source) => (
        <span className={source.availableQuantity > 0 ? 'browse-equipment-stock is-available' : 'browse-equipment-stock is-unavailable'}>
          {source.availableQuantity > 0 ? source.availableQuantity + ' ' + source.uom + ' available' : 'Unavailable'}
        </span>
      ),
    },
    {
      id: 'approval',
      title: 'Approval',
      value: (source) => approvalPath(source.policy),
      cell: (source) => <span className="browse-equipment-approval">{approvalPath(source.policy)}</span>,
    },
    {
      id: 'type',
      title: 'Type',
      value: (source) => source.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable',
    },
    {
      id: 'action',
      title: 'Action',
      value: () => '',
      sortable: false,
      cell: (source) => (
        <Button variant="outline" size="sm" onClick={(event) => openDetail(source, event.currentTarget)}>
          View <ChevronRight size={14} aria-hidden="true"/>
        </Button>
      ),
    },
  ];
  const detailMaximum = chosen ? Math.min(quantityLimit(chosen), chosen.availableQuantity) : 0;
  const alreadyAdded = chosen && basket.some((line) => sourceKey(line) === sourceKey(chosen));

  return (
    <div className="student-page browse-equipment-page">
      <PageHeader
        eyebrow={audience}
        title="Browse Equipment"
        description="Browse available laboratory equipment and supplies."
        actions={
          <Button onClick={start}>
            <ShoppingBasket size={16} aria-hidden="true"/>
            Start borrowing request{basket.length ? ` (${basket.length})` : ''}
          </Button>
        }
      />

      {notice && <p role="status" className="browse-equipment-notice">{notice}</p>}
      {[sources.error, catalogue.error, categories.error].filter(Boolean).map((error, index) =>
        <ErrorNotice key={index} message={error!}/>)}

      <section className="browse-equipment-catalogue" aria-label="Equipment catalogue">
        <div className="browse-equipment-toolbar">
          <div className="browse-equipment-search">
            <Search size={17} aria-hidden="true" />
            <Input
              placeholder="Search equipment or laboratory"
              aria-label="Search equipment or laboratory"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" type="button" aria-expanded={showFilters}
            aria-controls="browse-equipment-advanced" onClick={() => setShowFilters((value) => !value)}>
            <SlidersHorizontal size={15} aria-hidden="true"/> Filters
          </Button>
          {filterActive && <Button size="sm" variant="ghost" onClick={resetFilters}>Clear</Button>}
          <span className="browse-equipment-toolbar-spacer" aria-hidden="true" />
          <span className="browse-equipment-toolbar-count">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            {basket.length > 0 && ` · ${basket.length} selected`}
          </span>
        </div>

        {showFilters && (
          <div id="browse-equipment-advanced" className="browse-equipment-advanced">
            <label>Category
              <StudentSelect value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categoryNames.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </StudentSelect>
            </label>
            <label>Laboratory
              <StudentSelect value={lab} onChange={(event) => setLab(event.target.value)}>
                <option value="">All laboratories</option>
                {Array.from(new Map(all.map((source) => [source.labId, labName(source)])).entries()).map(([id, name]) =>
                  <option key={id} value={id}>{name}</option>)}
              </StudentSelect>
            </label>
            <label>Availability
              <StudentSelect value={available} onChange={(event) => setAvailable(event.target.value)}>
                <option value="">All equipment</option><option value="yes">Available</option><option value="no">Unavailable</option>
              </StudentSelect>
            </label>
            <label>Type
              <StudentSelect value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="">All types</option><option value="RETURNABLE">Returnable</option><option value="CONSUMABLE">Consumable</option>
              </StudentSelect>
            </label>
          </div>
        )}

        {!sources.data && !sources.error ? (
          <div role="status" className="browse-equipment-loading">
            <Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/>
            <span className="sr-only">Loading equipment</span>
          </div>
        ) : sources.data ? (
          <div className="browse-equipment-table">
            <StudentDataTable
              data={filtered}
              columns={columns}
              query={query}
              recordId={sourceKey}
              selectedId={selected}
              label="Equipment catalogue"
              emptyKind="equipment"
              filtered={filterActive}
              compactToolbar
              onReset={resetFilters}
            />
          </div>
        ) : null}
      </section>

      <Dialog open={Boolean(chosen)} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent
          className="browse-equipment-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader className="browse-equipment-dialog-header">
            <p className="browse-equipment-eyebrow">EQUIPMENT DETAILS</p>
            <div className="browse-equipment-identity">
              <span className="browse-equipment-identity-icon"><Package size={24} aria-hidden="true" /></span>
              <div className="browse-equipment-identity-copy">
                <DialogTitle>{chosen ? itemName(chosen) : 'Equipment details'}</DialogTitle>
                <DialogDescription>{chosen ? categoryFor(chosen) : 'Equipment catalogue'}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {chosen && (
            <div className="browse-equipment-dialog-content">
              <div className="browse-equipment-dialog-stock">
                <div>
                  <span className={chosen.availableQuantity > 0 ? 'browse-availability-dot is-available' : 'browse-availability-dot is-unavailable'}/>
                  <strong>{chosen.availableQuantity > 0 ? 'In stock' : 'Currently unavailable'}</strong>
                  <small>Available for borrowing</small>
                </div>
                <div className="browse-equipment-dialog-stock-value">
                  <strong>{chosen.availableQuantity}</strong><span>{chosen.uom}</span>
                </div>
              </div>
              <dl className="browse-equipment-dialog-facts">
                <div><dt>Laboratory</dt><dd>{labName(chosen)}</dd></div>
                <div><dt>Type</dt><dd>{chosen.kind === 'RETURNABLE' ? 'Returnable equipment' : 'Consumable'}</dd></div>
                <div><dt>Approval</dt><dd>{approvalPath(chosen.policy)}</dd></div>
              </dl>
              {itemFor(chosen)?.specifications && Object.keys(itemFor(chosen)!.specifications!).length > 0 && (
                <details className="browse-equipment-specifications browse-equipment-specifications-refined">
                  <summary>Specifications <ChevronRight size={15} aria-hidden="true" /></summary>
                  <dl>{Object.entries(itemFor(chosen)!.specifications!).map(([key, value]) =>
                    <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
                </details>
              )}
              <div className="browse-equipment-dialog-request">
                <div className="browse-equipment-dialog-request-label">
                  <div><strong>Request quantity</strong><small>{detailMaximum > 0
                    ? `Up to ${detailMaximum} ${chosen.uom}`
                    : 'This equipment is unavailable'}</small></div>
                  {alreadyAdded && <span className="browse-equipment-row-selected">Already selected</span>}
                </div>
                <div className="browse-equipment-dialog-actions">
                  <div className="browse-equipment-stepper" role="group" aria-label="Quantity to request">
                    <Button type="button" variant="outline" size="icon" aria-label="Decrease quantity"
                      disabled={detailMaximum < 1 || quantity <= 1}
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                      <Minus size={16} />
                    </Button>
                    <Input id="browse-equipment-quantity" aria-label="Quantity" inputMode="numeric"
                      type="number" min={1} max={detailMaximum} value={quantity}
                      disabled={detailMaximum < 1}
                      onChange={(event) => setQuantity(Number(event.target.value))}/>
                    <Button type="button" variant="outline" size="icon" aria-label="Increase quantity"
                      disabled={detailMaximum < 1 || quantity >= detailMaximum}
                      onClick={() => setQuantity((value) => Math.min(detailMaximum, value + 1))}>
                      <Plus size={16} />
                    </Button>
                  </div>
                  <Button className="browse-equipment-confirm-button" onClick={() => add(chosen)}
                    disabled={detailMaximum < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > detailMaximum}>
                    <ShoppingBasket size={16} aria-hidden="true" />
                    {alreadyAdded ? 'Update selection' : 'Add to request'}
                  </Button>
                </div>
                {alreadyAdded && <button type="button" className="browse-equipment-remove-selection"
                  onClick={() => { updateBasket(basket.filter((line) => sourceKey(line) !== sourceKey(chosen))); closeDetail(); }}>
                  Remove from selection
                </button>}
                {notice && <p className="browse-equipment-action-notice" role="status">{notice}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
