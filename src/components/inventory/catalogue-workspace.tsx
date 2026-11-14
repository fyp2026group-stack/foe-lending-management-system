'use client';

import { useRef, useState } from 'react';
import type { Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/module-tabs';
import { ReviewPanel, ReviewWorkspace } from '@/components/ui/review-sheet';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import type { Item, Named } from './api';
import { useInventoryLookup } from './lookups';
import { useInventory, ItemDetail, StockOperations, ImportPanel } from './inventory';
import { Definitions, DefinitionEditor } from './definitions';
import { catalogueRows, type CatalogueSort, stockLabel } from './catalogue-model';

const initialFilters = { q: '', kind: '', categoryId: '', labId: '', status: '', active: '' };
export function CatalogueWorkspace({
  session,
  oversight = false,
}: {
  session: Session;
  oversight?: boolean;
}) {
  const admin = session.user.roles.includes('ADMIN');
  const stockActor = session.user.roles.includes('TECHNICAL_OFFICER');
  const physical = admin || stockActor;
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<CatalogueSort>('name');
  const [descending, setDescending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState('catalogue');
  const [detail, setDetail] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value && key !== 'status') query.set(key, value);
  const items = useInventoryLookup<Item>('items?' + query, revision);
  const categories = useInventoryLookup<Named>('categories', revision);
  const locations = useInventoryLookup<Named>('locations', revision);
  const adminLabs = useInventory<{ items: Named[] }>(
    admin ? '/api/admin/laboratories' : 'locations?limit=1',
    revision
  );
  const labs: Named[] = admin
    ? (adminLabs.data?.items ?? [])
    : Array.from(
        new Set(
          (locations.data?.items ?? [])
            .map((l) => l.labId)
            .filter((id): id is string => Boolean(id))
        )
      ).map((id) => ({
        id,
        name: (locations.data?.items ?? [])
          .filter((l) => l.labId === id)
          .map((l) => l.name)
          .join(' / '),
      }));
  const cells = undefined;
  const ready = Boolean(items.data);
  const rows = catalogueRows(items.data?.items ?? [], cells, filters.status, sort, descending);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totals = rows.reduce(
    (total, row) => ({
      available: total.available + row.balance.available,
      reserved: total.reserved + (row.balance.reserved ?? 0),
      borrowed: total.borrowed + (row.balance.borrowed ?? 0),
    }),
    { available: 0, reserved: 0, borrowed: 0 }
  );
  const disclosed = (key: 'reserved' | 'borrowed') =>
    Boolean(cells) ||
    Boolean(
      items.data?.items.length && items.data.items.every((item) => typeof item[key] === 'number')
    );
  const errors = [
    items.error,
    categories.error,
    locations.error,
    admin ? adminLabs.error : undefined,
  ].filter((error): error is string => Boolean(error));
  function reload() {
    setRevision((value) => value + 1);
  }
  function sortBy(key: CatalogueSort) {
    setDescending(sort === key ? !descending : false);
    setSort(key);
    setPage(1);
  }
  function clear() {
    setDraft(initialFilters);
    setFilters(initialFilters);
    setPage(1);
    setDetail(null);
  }
  const active = Object.entries(filters).filter(([, value]) => value);
  const currentDetail = detail
    ? (items.data?.items.find((item) => item.id === detail.id) ?? detail)
    : null;
  return (
    <>
      <PageHeader
        eyebrow={oversight ? 'Department stock position' : 'Inventory management'}
        title={oversight ? 'Inventory Oversight' : 'Laboratory inventory'}
        description={
          oversight
            ? 'Review catalogue, laboratory balances, assets, movements and explicit approval policies across the authorized department scope.'
            : 'Check availability, review equipment and keep laboratory stock accurate.'
        }
        actions={
          admin ? (
            <Button onClick={() => setTab('definitions')}>Manage catalogue</Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setDetail(null);
        }}
        label="Inventory sections"
        items={[
          { value: 'catalogue', label: 'Inventory' },
          ...(admin ? [{ value: 'definitions', label: 'Catalogue setup' }] : []),
          ...(physical ? [{ value: 'stock operations', label: 'Stock operations' }] : []),
          ...(stockActor ? [{ value: 'imports', label: 'Receipt imports' }] : []),
        ]}
        action={
          <Button variant="outline" onClick={reload}>
            Refresh records
          </Button>
        }
      >
        {errors.map((error, index) => (
          <ErrorNotice key={index} message={error} />
        ))}
        {tab === 'catalogue' && (
          <>
            <dl className="inventory-summary" aria-label="Stock totals for filtered items">
              <div>
                <dt>Catalogue items</dt>
                <dd>{ready ? rows.length : '—'}</dd>
              </div>
              <div>
                <dt>Available units</dt>
                <dd>{ready ? totals.available : '—'}</dd>
              </div>
              <div>
                <dt>Reserved units</dt>
                <dd>{ready && disclosed('reserved') ? totals.reserved : '—'}</dd>
              </div>
              <div>
                <dt>Borrowed equipment</dt>
                <dd>{ready && disclosed('borrowed') ? totals.borrowed : '—'}</dd>
              </div>
            </dl>
            <p className="muted inventory-scope">
              {physical
                ? 'Balances reflect stock in your authorized laboratories and current filters.'
                : 'Availability is supplied by the catalogue. A dash means this balance is not disclosed to your role.'}{' '}
              Quantities use each item’s unit of measure.
            </p>
            <ReviewWorkspace>
              <section className="records inventory-records">
                <form
                  className="inventory-toolbar"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setFilters(draft);
                    setPage(1);
                    setDetail(null);
                  }}
                >
                  <div className="inventory-search">
                    <label htmlFor="inventory-search">Search inventory</label>
                    <Input
                      ref={search}
                      id="inventory-search"
                      maxLength={120}
                      placeholder="Find an item by name…"
                      value={draft.q}
                      onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="inventory-category">Category</label>
                    <select
                      id="inventory-category"
                      value={draft.categoryId}
                      onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                    >
                      <option value="">All categories</option>
                      {categories.data?.items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="inventory-type">Type</label>
                    <select
                      id="inventory-type"
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                    >
                      <option value="">All types</option>
                      <option value="RETURNABLE">Returnable equipment</option>
                      <option value="CONSUMABLE">Consumables</option>
                    </select>
                  </div>
                  {physical && (
                    <div>
                      <label htmlFor="inventory-lab">Laboratory</label>
                      <select
                        id="inventory-lab"
                        value={draft.labId}
                        onChange={(e) => setDraft({ ...draft, labId: e.target.value })}
                      >
                        <option value="">All authorized labs</option>
                        {labs.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="inventory-status">Stock status</label>
                    <select
                      id="inventory-status"
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    >
                      <option value="">All states</option>
                      <option value="available">Available</option>
                      {disclosed('reserved') && (
                        <>
                          <option value="reserved">Reserved</option>
                          <option value="borrowed">Borrowed equipment</option>
                          <option value="inspection">Inspection</option>
                          <option value="maintenance">Maintenance</option>
                        </>
                      )}
                    </select>
                  </div>
                  {admin && (
                    <div>
                      <label htmlFor="inventory-active">Catalogue status</label>
                      <select
                        id="inventory-active"
                        value={draft.active}
                        onChange={(e) => setDraft({ ...draft, active: e.target.value })}
                      >
                        <option value="">All records</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  )}
                  <Button type="submit">Apply</Button>
                </form>
                {active.length > 0 && (
                  <div className="active-filters" aria-label="Active inventory filters">
                    {active.map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key === 'categoryId'
                          ? (categories.data?.items.find((c) => c.id === value)?.name ?? 'Category')
                          : key === 'labId'
                            ? (labs.find((l) => l.id === value)?.name ?? 'Laboratory')
                            : key === 'kind'
                              ? value === 'RETURNABLE'
                                ? 'Returnable equipment'
                                : 'Consumables'
                              : key === 'active'
                                ? value === 'true'
                                  ? 'Active items'
                                  : 'Inactive items'
                                : key === 'status'
                                  ? stockLabel(value.toUpperCase())
                                  : `Search: ${value}`}
                      </Badge>
                    ))}
                    <Button variant="ghost" onClick={clear}>
                      Clear filters
                    </Button>
                  </div>
                )}
                {!ready && !items.error ? (
                  <p className="empty-state" role="status">
                    Loading inventory and reconciled balances…
                  </p>
                ) : (
                  ready && (
                    <>
                      <div
                        className="table-region"
                        role="region"
                        tabIndex={0}
                        aria-label="Inventory table; scroll horizontally for all columns"
                      >
                        <Table>
                          <TableCaption>
                            Balances from current database records. Select an item to review
                            availability, asset identity and movements.
                          </TableCaption>
                          <TableHeader>
                            <TableRow>
                              {(['name', 'available', 'reserved', 'borrowed'] as const).map(
                                (key) => (
                                  <TableHead
                                    key={key}
                                    scope="col"
                                    aria-sort={
                                      sort === key
                                        ? descending
                                          ? 'descending'
                                          : 'ascending'
                                        : 'none'
                                    }
                                  >
                                    <button
                                      type="button"
                                      className="table-sort"
                                      onClick={() => sortBy(key)}
                                    >
                                      {key === 'name'
                                        ? 'Item'
                                        : key === 'borrowed'
                                          ? 'Borrowed equipment'
                                          : key.charAt(0).toUpperCase() + key.slice(1)}
                                      <span aria-hidden="true">
                                        {sort === key ? (descending ? ' ↓' : ' ↑') : ' ↕'}
                                      </span>
                                    </button>
                                  </TableHead>
                                )
                              )}
                              <TableHead scope="col">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visible.map(({ item, balance }) => (
                              <TableRow
                                key={item.id}
                                data-selected={detail?.id === item.id || undefined}
                              >
                                <TableCell>
                                  <strong>{item.name}</strong>
                                  <span className="inventory-item-meta">
                                    {item.kind === 'RETURNABLE' ? 'Equipment' : 'Consumable'} ·{' '}
                                    {categories.data?.items.find((c) => c.id === item.categoryId)
                                      ?.name ?? 'Uncategorized'}{' '}
                                    · {item.uom ?? 'Unit unspecified'}
                                    {item.active === false ? ' · Inactive' : ''}
                                  </span>
                                </TableCell>
                                <TableCell className="quantity-cell">{balance.available}</TableCell>
                                <TableCell className="quantity-cell">
                                  {balance.reserved ?? '—'}
                                </TableCell>
                                <TableCell className="quantity-cell">
                                  {balance.borrowed ?? '—'}
                                </TableCell>
                                <TableCell>
                                  <div className="row-actions">
                                    <Button
                                      variant="outline"
                                      onClick={(event) => {
                                        origin.current = event.currentTarget;
                                        setDetail(item);
                                      }}
                                      aria-label={`Review ${item.name}`}
                                    >
                                      Review
                                    </Button>
                                    {admin && (
                                      <Button
                                        variant="ghost"
                                        onClick={() => setEditing(item)}
                                        aria-label={`Edit ${item.name}`}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {!rows.length && (
                        <div className="empty-state" role="status">
                          <h3>No matching inventory</h3>
                          <p>Try a broader search or clear your filters.</p>
                          {active.length > 0 && (
                            <Button variant="outline" onClick={clear}>
                              Clear filters
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="pagination">
                        <span role="status">
                          {rows.length
                            ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} items`
                            : '0 items'}
                        </span>
                        <label htmlFor="inventory-page-size">
                          Rows
                          <select
                            id="inventory-page-size"
                            value={pageSize}
                            onChange={(event) => {
                              setPageSize(Number(event.target.value));
                              setPage(1);
                            }}
                          >
                            {[10, 20, 50].map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                        <Button
                          variant="outline"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                          aria-label="Previous inventory page"
                        >
                          Previous
                        </Button>
                        <span>
                          {currentPage} / {pageCount}
                        </span>
                        <Button
                          variant="outline"
                          disabled={currentPage >= pageCount}
                          onClick={() => setPage(currentPage + 1)}
                          aria-label="Next inventory page"
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  )
                )}
              </section>
              {currentDetail && (
                <ReviewPanel
                  open
                  onOpenChange={(open) => {
                    if (!open) {
                      setDetail(null);
                      requestAnimationFrame(() =>
                        (origin.current?.isConnected ? origin.current : search.current)?.focus()
                      );
                    }
                  }}
                  title={currentDetail.name}
                  description="Availability, physical assets and recorded stock movements."
                >
                  <ItemDetail
                    key={currentDetail.id}
                    item={currentDetail}
                    revision={revision}
                    labId={filters.labId}
                    physical={physical}
                  />
                  {admin && (
                    <Button variant="outline" onClick={() => setEditing(currentDetail)}>
                      Edit catalogue details
                    </Button>
                  )}
                </ReviewPanel>
              )}
            </ReviewWorkspace>
          </>
        )}
        {tab === 'definitions' && (
          <Definitions
            session={session}
            categories={categories.data?.items ?? []}
            locations={locations.data?.items ?? []}
            labs={labs}
            onSaved={reload}
            revision={revision}
          />
        )}
        {tab === 'stock operations' && (
          <StockOperations
            session={session}
            items={items.data?.items ?? []}
            labs={labs}
            locations={locations.data?.items ?? []}
            onSaved={reload}
            revision={revision}
          />
        )}
        {tab === 'imports' && <ImportPanel session={session} onSaved={reload} />}
      </Tabs>
      {editing && (
        <DefinitionEditor
          resource="items"
          record={editing}
          session={session}
          categories={categories.data?.items ?? []}
          labs={labs}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
