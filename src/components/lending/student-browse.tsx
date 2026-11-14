'use client';
import { StudentEmptyState } from './student-empty-state';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentSelect } from './student-controls';
import { StudentDataTable, type StudentColumn } from './student-data-table';
import { Package } from 'lucide-react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item, Named } from '@/components/inventory/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useLendingChoices } from './shared';
import { approvalPath, sourceKey, persistStudentSelection } from './student-model';
import { quantityLimit } from './request-options';
import type { LendingSource, DraftPayload } from './api';

export function StudentBrowse({
  session,
  audience = 'Student workspace',
}: {
  session: Session;
  audience?: string;
}) {
  const router = useRouter();
  const mobile = useIsMobile();
  const returnFocus = useRef<HTMLButtonElement>(null);
  const catalogueFocus = useRef<HTMLDivElement>(null);
  const sources = useLendingChoices<LendingSource>('sources', 0);
  const catalogue = useInventoryLookup<Item>('items?active=true', 0);
  const categories = useInventoryLookup<Named>('categories', 0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [lab, setLab] = useState('');
  const [available, setAvailable] = useState('');
  const [kind, setKind] = useState('');
  const [selected, setSelected] = useState('');
  const [full, setFull] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [basket, setBasket] = useState<DraftPayload['lines']>([]);
  const [notice, setNotice] = useState('');
  const all = sources.data?.items ?? [];
  const itemFor = (s: LendingSource) => catalogue.data?.items.find((i) => i.id === s.itemId);
  const categoryFor = (s: LendingSource) =>
    categories.data?.items.find((c) => c.id === itemFor(s)?.categoryId)?.name ?? 'Not supplied';
  const filtered = all.filter(
    (s) =>
      (!query ||
        (s.item + ' ' + s.lab + ' ' + s.location).toLowerCase().includes(query.toLowerCase())) &&
      (!category || itemFor(s)?.categoryId === category) &&
      (!lab || s.labId === lab) &&
      (!kind || s.kind === kind) &&
      (!available || (available === 'yes' ? s.availableQuantity > 0 : s.availableQuantity === 0))
  );
  const chosen = filtered.find((s) => sourceKey(s) === selected);
  function start() {
    try {
      persistStudentSelection(sessionStorage, session.user.id, basket);
      router.push('/borrowing?view=new');
    } catch {
      setNotice(
        'Selection could not be carried forward. Your choices remain here; enable browser storage and retry.'
      );
    }
  }
  function updateBasket(next: DraftPayload['lines']) {
    setBasket(next);
    try {
      persistStudentSelection(sessionStorage, session.user.id, next);
      setNotice('');
    } catch {
      setNotice(
        'Browser storage is unavailable. Your selection is kept on this page; restore storage before starting the request.'
      );
    }
  }
  function add(s: LendingSource) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > quantityLimit(s)) {
      setNotice('Choose a whole quantity within the displayed request limit.');
      return;
    }
    const existing = basket.find((l) => sourceKey(l) === sourceKey(s));
    if (!existing && basket.length >= 20) {
      setNotice('A request supports up to 20 different sources.');
      return;
    }
    updateBasket([
      ...basket.filter((l) => sourceKey(l) !== sourceKey(s)),
      { itemId: s.itemId, labId: s.labId, locationId: s.locationId, quantity },
    ]);
    toast(`${s.item}: ${quantity} selected for your request.`);
  }

  function restoreFocus() {
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    else catalogueFocus.current?.focus();
  }
  function closeDetail() {
    setSelected('');
    setFull(false);
    restoreFocus();
  }
  useEffect(() => {
    if (selected && !chosen) {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else catalogueFocus.current?.focus();
    }
  }, [selected, chosen]);
  const columns: StudentColumn<LendingSource>[] = [
    {
      id: 'equipment',
      title: 'Equipment',
      value: (s) => s.item + ' ' + s.lab + ' ' + s.location,
      cell: (s) => (
        <span className="student-item">
          <Package size={24} aria-hidden="true" />
          <strong>{s.item}</strong>
        </span>
      ),
    },
    { id: 'category', title: 'Category', value: categoryFor },
    {
      id: 'laboratory',
      title: 'Laboratory',
      value: (s) => s.lab,
      cell: (s) => (
        <>
          {s.lab}
          <small className="block">{s.location}</small>
        </>
      ),
    },
    {
      id: 'available',
      title: 'Availability',
      numeric: true,
      value: (s) => s.availableQuantity,
      cell: (s) => (
        <Badge variant="secondary">
          {s.availableQuantity} {s.uom}
        </Badge>
      ),
    },
    {
      id: 'policy',
      title: 'Approval policy',
      value: (s) => approvalPath(s.policy),
    },
    {
      id: 'type',
      title: 'Type',
      value: (s) => (s.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'),
    },
    {
      id: 'action',
      title: 'Action',
      value: () => '',
      sortable: false,
      cell: (s) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setSelected(sourceKey(s));
            if (window.matchMedia('(max-width: 900px)').matches) setFull(true);
            setQuantity(basket.find((l) => sourceKey(l) === sourceKey(s))?.quantity ?? 1);
          }}
        >
          View
        </Button>
      ),
    },
  ];
  const detail = chosen && (
    <>
      <div className="student-equipment-placeholder">
        <Package size={48} aria-hidden="true" />
        <span>No equipment image supplied</span>
      </div>
      <h2>{chosen.item}</h2>
      <div className="flex gap-2">
        <Badge variant="secondary">
          {chosen.availableQuantity > 0 ? 'Available' : 'Unavailable'}
        </Badge>
        <Badge variant="outline">
          {chosen.kind === 'RETURNABLE' ? 'Returnable' : 'Consumable'}
        </Badge>
      </div>
      <dl className="review-facts">
        {[
          ['Category', categoryFor(chosen)],
          ['Laboratory', chosen.lab],
          ['Location', chosen.location],
          ['Approval', approvalPath(chosen.policy)],
          ['Available', `${chosen.availableQuantity} ${chosen.uom}`],
          ['Request limit', `${quantityLimit(chosen)} ${chosen.uom}`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p>
        Current availability is not a future booking guarantee. The server revalidates quantities
        and approval requirements when you submit.
      </p>
      {itemFor(chosen)?.specifications && (
        <dl>
          {Object.entries(itemFor(chosen)!.specifications!).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <label>
        Quantity
        <Input
          type="number"
          min={1}
          max={quantityLimit(chosen)}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </label>
      <Button onClick={() => add(chosen)}>Add to request</Button>
      {!full && (
        <Button variant="outline" onClick={() => setFull(true)}>
          View full details
        </Button>
      )}
    </>
  );
  return (
    <div className="student-page">
      <PageHeader
        eyebrow={audience}
        title="Browse Equipment"
        description="Find equipment and supplies available for your laboratory work."
        actions={
          <Button onClick={start}>
            Start borrowing request{basket.length ? ` (${basket.length})` : ''}
          </Button>
        }
      />
      <div className="student-metrics student-metrics-four">
        {[
          ['Equipment', new Set(all.map((s) => s.itemId)).size],
          ['Available sources', all.filter((s) => s.availableQuantity > 0).length],
          ['Laboratories', new Set(all.map((s) => s.labId)).size],
          ['Selected items', basket.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <span>{label}</span>
            <strong>{sources.data ? value : '-'}</strong>
          </Card>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      {basket.length > 0 && (
        <div className="student-selection">
          <strong>Selected for request</strong>
          {basket.map((line) => (
            <span key={sourceKey(line)}>
              {all.find((s) => sourceKey(s) === sourceKey(line))?.item ?? 'Selected equipment'} x{' '}
              {line.quantity}{' '}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateBasket(basket.filter((l) => sourceKey(l) !== sourceKey(line)))}
              >
                Remove
              </Button>
            </span>
          ))}
        </div>
      )}
      {[sources.error, catalogue.error, categories.error].filter(Boolean).map((error, i) => (
        <ErrorNotice key={i} message={error!} />
      ))}
      <div
        className={filtered.length ? 'student-browse-grid' : 'student-browse-grid is-empty'}
        ref={catalogueFocus}
        tabIndex={-1}
      >
        <Card className="student-catalogue">
          <div className="student-filters">
            <label className="student-search">
              Search equipment
              <Input
                placeholder="Search by equipment name or laboratory"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
            </label>
            <label>
              Category
              <StudentSelect
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                }}
              >
                <option value="">All categories</option>
                {categories.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </StudentSelect>
            </label>
            <label>
              Laboratory
              <StudentSelect
                value={lab}
                onChange={(e) => {
                  setLab(e.target.value);
                }}
              >
                <option value="">All laboratories</option>
                {Array.from(new Map(all.map((s) => [s.labId, s.lab])).entries()).map(
                  ([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  )
                )}
              </StudentSelect>
            </label>
            <label>
              Availability
              <StudentSelect
                value={available}
                onChange={(e) => {
                  setAvailable(e.target.value);
                }}
              >
                <option value="">All availability</option>
                <option value="yes">Available</option>
                <option value="no">Unavailable</option>
              </StudentSelect>
            </label>
            <label>
              Type
              <StudentSelect
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                }}
              >
                <option value="">All types</option>
                <option value="RETURNABLE">Returnable</option>
                <option value="CONSUMABLE">Consumable</option>
              </StudentSelect>
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setCategory('');
                setLab('');
                setAvailable('');
                setKind('');
              }}
            >
              Reset filters
            </Button>
          </div>
          {!sources.data && !sources.error ? (
            <div className="p-4" role="status">
              <Skeleton className="h-10 mb-2" />
              <Skeleton className="h-10" />
              <span className="sr-only">Loading equipment</span>
            </div>
          ) : sources.data ? (
            <StudentDataTable
              data={filtered}
              columns={columns}
              query={query}
              recordId={sourceKey}
              selectedId={selected}
              label="Equipment catalogue"
              emptyKind="equipment"
              filtered={Boolean(query || category || lab || available || kind)}
              onReset={() => {
                setQuery('');
                setCategory('');
                setLab('');
                setAvailable('');
                setKind('');
              }}
            />
          ) : null}
        </Card>
        <Card
          className="student-equipment-detail student-card"
          role="complementary"
          aria-label="Equipment details"
        >
          {chosen ? (
            <>
              <Button variant="ghost" onClick={closeDetail}>
                Close details
              </Button>
              {detail}
            </>
          ) : (
            <StudentEmptyState
              kind="equipmentDetail"
              actionLabel="View first item"
              onAction={() => {
                if (filtered[0]) {
                  setSelected(sourceKey(filtered[0]));
                  setQuantity(1);
                  if (mobile) setFull(true);
                }
              }}
            />
          )}
        </Card>
      </div>
      {mobile ? (
        <Drawer
          open={Boolean(chosen) && full}
          onOpenChange={(open) => {
            setFull(open);
            if (!open) restoreFocus();
          }}
        >
          <DrawerContent className="student-mobile-detail max-h-[94dvh]">
            <DrawerHeader>
              <DrawerTitle>Equipment details</DrawerTitle>
              <DrawerDescription>Review this authorized equipment source.</DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="min-h-0 overflow-y-auto p-4">{detail}</ScrollArea>
            <DrawerClose asChild>
              <Button variant="outline" className="m-4">
                Close details
              </Button>
            </DrawerClose>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet
          open={Boolean(chosen) && full}
          onOpenChange={(open) => {
            setFull(open);
            if (!open) restoreFocus();
          }}
        >
          <SheetContent className="overflow-y-auto p-6">
            <SheetHeader>
              <SheetTitle>Equipment details</SheetTitle>
              <SheetDescription>Review the current authorized equipment source.</SheetDescription>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
