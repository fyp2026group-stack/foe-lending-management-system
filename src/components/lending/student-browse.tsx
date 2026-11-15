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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentDataTable, type StudentColumn } from './student-data-table';
import { StudentSelect } from './student-controls';
import { useLendingChoices } from './shared';
import { approvalPath, sourceKey, persistStudentSelection } from './student-model';
import { quantityLimit } from './request-options';
import type { LendingSource, DraftPayload } from './api';

// Synthetic catalogue records sometimes contain UUIDs in their display names.
// Keep their real identifiers for operations, but never present these as human-friendly names.
const uuidInName = /\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/gi;
function humanLabel(value: string | undefined, fallback: string) {
  const clean = (value ?? '').replace(uuidInName, '').replace(/[-–—:]+\\s*$/, '').trim();
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
  const selectedCount = basket.reduce((sum, line) => sum + line.quantity, 0);

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
    // Radix restores keyboard focus to the initiating control when the sheet closes.
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
          <span><strong>{itemName(source)}</strong><small>{categoryFor(source)}</small></span>
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

      <div className="browse-equipment-overview" aria-live="polite">
        <div><strong>{sources.data ? new Set(all.map((source) => source.itemId)).size : '—'}</strong><span>Equipment types</span></div>
        <div><strong>{sources.data ? all.filter((source) => source.availableQuantity > 0).length : '—'}</strong><span>Available sources</span></div>
        <div><strong>{basket.length}</strong><span>Selected types</span></div>
      </div>

      {notice && <p role="status" className="browse-equipment-notice">{notice}</p>}
      {basket.length > 0 && (
        <div className="browse-equipment-selection" aria-label="Selected equipment">
          <div className="browse-equipment-selection-label"><ShoppingBasket size={16} aria-hidden="true"/>
            <strong>Selected for request</strong><span>{selectedCount} {selectedCount === 1 ? 'unit' : 'units'}</span>
          </div>
          <div className="browse-equipment-selected-items">
            {basket.map((line) => (
              <span className="browse-equipment-selection-chip" key={sourceKey(line)}>
                {(() => { const source = all.find((value) => sourceKey(value) === sourceKey(line)); return source ? itemName(source) : 'Equipment'; })()} × {line.quantity}
                <button type="button" aria-label="Remove selected equipment"
                  onClick={() => updateBasket(basket.filter((value) => sourceKey(value) !== sourceKey(line)))}>
                  <X size={13} aria-hidden="true"/>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {[sources.error, catalogue.error, categories.error].filter(Boolean).map((error, index) =>
        <ErrorNotice key={index} message={error!}/>)}

      <section className="browse-equipment-catalogue" aria-label="Equipment catalogue">
        <div className="browse-equipment-toolbar">
          <label className="browse-equipment-search">
            <Search size={17} aria-hidden="true"/>
            <span className="sr-only">Search equipment</span>
            <Input placeholder="Search equipment by name or laboratory" aria-label="Search equipment"
              value={query} onChange={(event) => setQuery(event.target.value)}/>
          </label>
          <Button size="sm" variant="outline" type="button" aria-expanded={showFilters}
            aria-controls="browse-equipment-advanced" onClick={() => setShowFilters((value) => !value)}>
            <SlidersHorizontal size={15} aria-hidden="true"/> Filters
          </Button>
          {filterActive && <Button size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button>}
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
              onReset={resetFilters}
            />
          </div>
        ) : null}
      </section>

      <Sheet open={Boolean(chosen)} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <SheetContent side="right" className="browse-equipment-sheet browse-equipment-sheet-refined">
          <SheetHeader className="browse-equipment-sheet-heading browse-equipment-sheet-heading-refined">
            <p className="browse-equipment-eyebrow">EQUIPMENT CATALOGUE</p>
            <div className="browse-equipment-identity">
              <span className="browse-equipment-identity-icon"><Package size={28} aria-hidden="true" /></span>
              <div className="browse-equipment-identity-copy">
                <SheetTitle>{chosen ? itemName(chosen) : 'Equipment details'}</SheetTitle>
                <SheetDescription>
                  {chosen ? categoryFor(chosen) : 'Catalogue item'}
                  {chosen ? ' · Ref ' + chosen.itemId.slice(0, 8).toUpperCase() : ''}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {chosen && (
            <div className="browse-equipment-sheet-scroll browse-equipment-sheet-scroll-refined">
              <section className="browse-equipment-availability-hero" aria-label="Availability">
                <div className="browse-equipment-availability-caption">
                  <div className="browse-equipment-availability-heading">
                    <span className={chosen.availableQuantity > 0 ? 'browse-availability-dot is-available' : 'browse-availability-dot is-unavailable'} />
                    <strong>{chosen.availableQuantity > 0 ? 'Available to request' : 'Currently unavailable'}</strong>
                  </div>
                  <p>{chosen.availableQuantity > 0
                    ? 'Stock available at the selected laboratory'
                    : 'No stock is available at this source'}</p>
                </div>
                <div className="browse-equipment-availability-value">
                  <strong>{chosen.availableQuantity}</strong><span>{chosen.uom}</span>
                </div>
              </section>
              <section className="browse-equipment-information" aria-labelledby="browse-equipment-information-heading">
                <h3 id="browse-equipment-information-heading">Equipment information</h3>
                <dl>
                  <div><dt>Laboratory</dt><dd>{labName(chosen)}</dd></div>
                  <div><dt>Equipment type</dt><dd>{chosen.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'}</dd></div>
                  <div><dt>Approval required</dt><dd>{approvalPath(chosen.policy)}</dd></div>
                </dl>
              </section>
              {itemFor(chosen)?.specifications && Object.entries(itemFor(chosen)!.specifications!).length > 0 && (
                <details className="browse-equipment-specifications browse-equipment-specifications-refined">
                  <summary>Technical specifications <ChevronRight size={16} aria-hidden="true" /></summary>
                  <dl>{Object.entries(itemFor(chosen)!.specifications!).map(([key, value]) =>
                    <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
                </details>
              )}
              <section className="browse-equipment-request-panel" aria-labelledby="browse-equipment-request-heading">
                <div className="browse-equipment-request-intro">
                  <div><h3 id="browse-equipment-request-heading">Add to your request</h3>
                    <p>{detailMaximum > 0 ? `Choose up to ${detailMaximum} ${chosen.uom}` : 'This equipment cannot currently be selected'}</p>
                  </div>
                  {alreadyAdded && <span className="browse-equipment-already-added">Selected</span>}
                </div>
                <div className="browse-equipment-request-controls">
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
                    {alreadyAdded ? 'Update quantity' : 'Add to request'}
                  </Button>
                </div>
                {notice && <p className="browse-equipment-action-notice" role="status">{notice}</p>}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
