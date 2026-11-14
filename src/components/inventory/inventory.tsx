'use client';
import { OfficerEmpty } from '@/components/technical-officer/empty-state';
import { ConfirmedForm, ConfirmedAction } from '@/components/ui/final-confirmation';
import { OfficerWorkspace } from '@/components/technical-officer/workspace';
import { LecturerWorkspace } from '@/components/lecturer/workspace';
import { StudentBrowse } from '@/components/lending/student-browse';
import { isStudent } from '@/components/lending/student-model';
import { useInventoryLookup, ItemPicker } from './lookups';
import { useEffect, useRef, useState, useId, type FormEvent } from 'react';
import { Authenticated, ErrorNotice } from '@/components/identity/session';
import { ApiError, type Session } from '@/components/identity/api';
import { ReviewSheet, useReviewLock } from '@/components/ui/review-sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field as FormField, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CatalogueWorkspace } from './catalogue-workspace';
import { stockLabel } from './catalogue-model';
import { Boxes, ClipboardList, History, MapPin, PackageOpen } from 'lucide-react';
import {
  inventoryRead,
  inventoryWrite,
  InventoryError,
  commandId,
  type ImportIssue,
  type Item,
  type Named,
  type Stock,
  type Asset,
  type Movement,
  type Adjustment,
  type Preview,
} from './api';

export function Inventory() {
  return (
    <Authenticated>
      {(session) =>
        session.user.roles.includes('TECHNICAL_OFFICER') ? (
          <OfficerWorkspace session={session} view="inventory" />
        ) : isStudent(session.user.roles) ? (
          <StudentBrowse session={session} />
        ) : session.user.roles.includes('LECTURER') ? (
          <LecturerWorkspace session={session} view="equipment" />
        ) : (
          <CatalogueWorkspace session={session} />
        )
      }
    </Authenticated>
  );
}
export function useInventory<T>(path: string, revision = 0): { data?: T; error?: string } {
  const [result, setResult] = useState<{
    path: string;
    revision: number;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    inventoryRead<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, revision, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            path,
            revision,
            error: error instanceof Error ? error.message : 'Unable to load inventory.',
          });
      });
    return () => controller.abort();
  }, [path, revision]);
  return result?.path === path && result.revision === revision ? result : {};
}
const selectionClass = 'min-h-11 border rounded-md bg-white px-3 w-full';
export function SelectField({
  name,
  label,
  options,
  required = true,
}: {
  name: string;
  label: string;
  options: Named[];
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <select className={selectionClass} id={name} name={name} required={required} defaultValue="">
        <option value="">Select {label.toLowerCase()}</option>
        {options
          .filter((option) => option.active !== false)
          .map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
      </select>
    </div>
  );
}
export function MutationForm({
  title,
  path,
  session,
  build,
  children,
  onSaved,
  context,
}: {
  title: string;
  path: string;
  session: Session;
  context?: React.ReactNode;
  build: (data: FormData) => unknown;
  children: React.ReactNode;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef<{ payload: string; id: string } | null>(null);
  useReviewLock(busy, pending);
  async function submit(data: FormData, form: HTMLFormElement) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const body = build(data) as Record<string, unknown>;
      const payload = JSON.stringify(body);
      if (pending.current && pending.current.payload !== payload)
        throw new Error(
          'Previous operation has an unresolved outcome. Reconcile its command and stock history before changing input.'
        );
      pending.current ??= { payload, id: commandId() };
      await inventoryWrite(path, { ...body, commandId: pending.current.id }, session.csrfToken);
      pending.current = null;
      setSuccess('Change accepted by server. Refreshing records.');
      form.reset();
      onSaved();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 409
      )
        pending.current = null;
      setError(
        error instanceof ApiError && error.status === 409
          ? 'Record changed. Reload and review current data before trying again.'
          : error instanceof Error
            ? error.message
            : 'Outcome unknown. Reload history before retrying; do not duplicate a stock operation.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="operation-form">
      <h2>{title}</h2>
      {error && <ErrorNotice message={error} />}
      <p role="status">{success}</p>
      <ConfirmedForm
        enabled={session.user.roles.includes('TECHNICAL_OFFICER')}
        title={title}
        onConfirmed={submit}
        context={context}
        className="mt-4"
      >
        <fieldset disabled={busy} className="grid gap-4">
          {children}
          <Button type="submit">{busy ? 'Submitting...' : title}</Button>
        </fieldset>
      </ConfirmedForm>
      <p className="muted mt-3">
        Server permissions apply. If the outcome is uncertain, check stock history before retrying.
      </p>
    </Card>
  );
}
export function TextField({
  name,
  label,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <FormField>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        {...(type === 'number' ? { step: 1, min: 1, max: 1000000 } : { maxLength: 200 })}
      />
    </FormField>
  );
}
export function ItemDetail({
  item,
  revision,
  labId = '',
  physical = true,
}: {
  item: Item;
  revision: number;
  labId?: string;
  physical?: boolean;
}) {
  const kind = item.kind === 'RETURNABLE' ? 'Returnable equipment' : 'Consumable';
  return (
    <div className="equipment-detail">
      <div className="equipment-detail-chips">
        <Badge variant="secondary"><Boxes className="size-3.5" aria-hidden="true" />{kind}</Badge>
        <Badge variant="outline" className={item.active === false ? 'equipment-muted-badge' : 'equipment-active-badge'}>
          <span aria-hidden="true" className="equipment-status-dot" />
          {item.active === false ? 'Inactive' : 'Active'}
        </Badge>
      </div>
      <section className="equipment-detail-section" aria-labelledby="equipment-overview-heading">
        <div className="equipment-section-heading">
          <ClipboardList className="size-4" aria-hidden="true" />
          <h2 id="equipment-overview-heading">Equipment overview</h2>
        </div>
        <dl className="equipment-facts">
          <div><dt>Item type</dt><dd>{kind}</dd></div>
          <div><dt>Unit of measure</dt><dd>{item.uom ?? 'Not specified'}</dd></div>
          <div><dt>Available</dt><dd>{item.available ?? 'Not disclosed'}</dd></div>
          <div><dt>Reserved</dt><dd>{item.reserved ?? 'Not disclosed'}</dd></div>
          <div><dt>Borrowed</dt><dd>{item.borrowed ?? 'Not disclosed'}</dd></div>
          <div><dt>Awaiting inspection</dt><dd>{item.inspection ?? 'Not disclosed'}</dd></div>
          <div><dt>In maintenance</dt><dd>{item.maintenance ?? 'Not disclosed'}</dd></div>
          <div><dt>Catalogue status</dt><dd>{item.active === false ? 'Inactive' : 'Active'}</dd></div>
        </dl>
      </section>
      {item.specifications && Object.keys(item.specifications).length > 0 && (
        <section className="equipment-detail-section" aria-labelledby="equipment-specifications-heading">
          <div className="equipment-section-heading">
            <ClipboardList className="size-4" aria-hidden="true" />
            <h2 id="equipment-specifications-heading">Specifications</h2>
          </div>
          <dl className="equipment-facts">
            {Object.entries(item.specifications).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>
      )}
      {physical ? (
        <PhysicalItemDetail item={item} revision={revision} labId={labId} />
      ) : (
        <p className="equipment-detail-private">
          Location-specific balances and movement history are restricted to authorized laboratory staff.
        </p>
      )}
    </div>
  );
}
function PhysicalItemDetail({
  item,
  revision,
  labId,
}: {
  item: Item;
  revision: number;
  labId: string;
}) {
  const query = 'itemId=' + encodeURIComponent(item.id) + (labId ? '&labId=' + encodeURIComponent(labId) : '');
  const stock = useInventoryLookup<Stock>('stock?' + query, revision);
  const assets = useInventoryLookup<Asset>('assets?' + query, revision);
  const movements = useInventoryLookup<Movement>('movements?' + query, revision);
  const locations = useInventoryLookup<Named>(
    'locations' + (labId ? '?labId=' + encodeURIComponent(labId) : ''), revision
  );
  const positive = stock.data?.items.filter((row) => row.quantity > 0) ?? [];
  return (
    <>
      <section className="equipment-detail-section" aria-labelledby="equipment-stock-heading">
        <div className="equipment-section-heading">
          <MapPin className="size-4" aria-hidden="true" />
          <h2 id="equipment-stock-heading">Stock by location and state</h2>
        </div>
        {[stock.error, assets.error, movements.error, locations.error]
          .filter(Boolean).map((error, index) => <ErrorNotice key={index} message={error!} />)}
        {!stock.data && !stock.error && <p role="status" className="equipment-loading">Loading stock balances…</p>}
        {positive.length > 0 && (
          <div className="equipment-stock-table" role="region" aria-label="Stock balances by location">
            <table>
              <thead><tr><th scope="col">State</th><th scope="col">Location</th><th scope="col">Quantity</th><th scope="col">Record version</th></tr></thead>
              <tbody>{positive.map((row) => (
                <tr key={row.id}>
                  <td><Badge variant="secondary">{stockLabel(row.state)}</Badge></td>
                  <td>{locations.data?.items.find((location) => location.id === row.locationId)?.name ?? 'Stock location'}</td>
                  <td className="equipment-quantity">{row.quantity} {item.uom ?? 'units'}</td>
                  <td className="equipment-version">v{row.version}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {stock.data && !positive.length && <p className="equipment-empty-inline">No current stock in this scope.</p>}
      </section>
      {item.kind !== 'CONSUMABLE' && (
        <section className="equipment-detail-section" aria-labelledby="equipment-assets-heading">
          <div className="equipment-section-heading">
            <Boxes className="size-4" aria-hidden="true" />
            <h2 id="equipment-assets-heading">Physical assets</h2>
          </div>
          {!assets.data && !assets.error && <p role="status" className="equipment-loading">Loading physical assets…</p>}
          {assets.data && !assets.data.items.length && (
            <div className="equipment-assets-empty">
              <PackageOpen className="size-6" aria-hidden="true" />
              <strong>No individually identified assets recorded</strong>
              <p>Equipment can be tracked by quantity until an individual asset is identified.</p>
            </div>
          )}
          {assets.data && assets.data.items.length > 0 && (
            <div className="equipment-assets-list">
              {assets.data.items.map((asset) => (
                <article key={asset.id} className="equipment-asset-row">
                  <div><strong>{asset.serial || 'Serial number not recorded'}</strong>
                    <span className="asset-reference">Asset ID: {asset.id}</span></div>
                  <Badge variant="secondary">{asset.state ? stockLabel(asset.state) : 'State unavailable'}</Badge>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="equipment-detail-section" aria-labelledby="equipment-movements-heading">
        <div className="equipment-section-heading">
          <History className="size-4" aria-hidden="true" />
          <h2 id="equipment-movements-heading">Movement history</h2>
        </div>
        {!movements.data && !movements.error && <p role="status" className="equipment-loading">Loading movement history…</p>}
        {movements.data && !movements.data.items.length && (
          <p className="equipment-empty-inline">No recorded movements for this equipment.</p>
        )}
        {movements.data && movements.data.items.length > 0 && (
          <ol className="equipment-movement-timeline">
            {movements.data.items.map((row) => (
              <li key={row.id} className="equipment-movement">
                <div className="equipment-movement-meta">
                  <Badge variant="secondary">{stockLabel(row.kind)}</Badge>
                  <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('en-GB')}</time>
                </div>
                <p className="equipment-movement-reason">{row.reason || 'Stock movement recorded'}</p>
                {Boolean(row.entries?.length) && (
                  <ul className="equipment-movement-entries">
                    {row.entries?.map((entry, index) => (
                      <li key={index}>
                        {entry.locationName ?? (entry.cellId ? 'Stock location' : 'External account')}
                        {entry.state ? ' · ' + stockLabel(entry.state) : ''}:
                        <strong>{entry.delta > 0 ? '+' : ''}{entry.delta}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
function ReceiptFields({ labs, locations }: { labs: Named[]; locations: Named[] }) {
  const [labId, setLabId] = useState('');
  return (
    <>
      <ItemPicker name="receiptItem" label="Receipt item" />
      <div>
        <label htmlFor="receiptLab">Laboratory</label>
        <select
          id="receiptLab"
          name="receiptLab"
          required
          className={selectionClass}
          value={labId}
          onChange={(event) => setLabId(event.target.value)}
        >
          <option value="">Choose laboratory</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name}
            </option>
          ))}
        </select>
      </div>
      <SelectField
        key={labId}
        name="receiptLocation"
        label="Stock location"
        options={locations.filter((location) => location.labId === labId)}
      />
      <TextField name="receiptQuantity" label="Quantity received" type="number" />
      <TextField name="provenance" label="Unique physical receipt reference" />
    </>
  );
}
export function ReceiveItemsDialog({open,onOpenChange,session,labs,locations,onSaved}:{
 open:boolean;onOpenChange:(value:boolean)=>void;session:Session;labs:Named[];locations:Named[];onSaved:()=>void;
}) {
 return <ReviewSheet open={open} onOpenChange={onOpenChange} title="Add items to inventory"
  description="Record equipment received at your laboratory. You can identify each physical unit later.">
   <MutationForm title="Save received items" path="receipts" session={session}
    onSaved={()=>{onSaved();onOpenChange(false);}}
    build={d=>({itemId:d.get('receiptItem'),labId:d.get('receiptLab'),locationId:d.get('receiptLocation'),
      quantity:Number(d.get('receiptQuantity')),provenance:d.get('provenance')})}>
    <p className="inventory-form-guidance">Choose an existing equipment type, enter how many units arrived
      and where they are stored. Individual serial numbers can be recorded later, including at handover.
      Identifying a unit does not increase stock.</p>
    <ReceiptFields labs={labs} locations={locations}/>
   </MutationForm>
 </ReviewSheet>;
}

export function StockOperations({
  session,
  items: catalogueItems,
  labs,
  locations,
  onSaved,
  revision,
  inspectionWorkflow = false,
}: {
  session: Session;
  items: Item[];
  labs: Named[];
  locations: Named[];
  onSaved: () => void;
  revision: number;
  inspectionWorkflow?: boolean;
}) {
  const itemLookup = useInventoryLookup<Item>('items', revision);
  const items = itemLookup.data?.items ?? catalogueItems;
  const stock = useInventoryLookup<Stock>('stock', revision);
  const adjustments = useInventoryLookup<Adjustment>('adjustments', revision);
  const recent = useInventoryLookup<Movement>('movements', revision);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cellId, setCellId] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const cell = stock.data?.items.find((row) => row.id === cellId);
  const technical = session.user.roles.includes('TECHNICAL_OFFICER');
  const admin = session.user.roles.includes('ADMIN');
  const [approve, setApprove] = useState<Adjustment | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveError, setApproveError] = useState('');
  const approvalCommands = useRef<Record<string, string>>({});
  const stockContext = cell ? (
    <dl className="review-facts">
      <div>
        <dt>Equipment</dt>
        <dd>{items.find((i) => i.id === cell.itemId)?.name ?? cell.itemId}</dd>
      </div>
      <div>
        <dt>Laboratory / location</dt>
        <dd>
          {labs.find((l) => l.id === cell.labId)?.name ?? cell.labId} /{' '}
          {locations.find((l) => l.id === cell.locationId)?.name ?? cell.locationId}
        </dd>
      </div>
      <div>
        <dt>Stock cell / version</dt>
        <dd>
          {cell.id} / {cell.version}
        </dd>
      </div>
      <div>
        <dt>Quantity / asset</dt>
        <dd>
          {cell.quantity} / {cell.assetId ?? 'Anonymous stock'}
        </dd>
      </div>
    </dl>
  ) : null;
  function cellBody() {
    if (!cell) throw new Error('Select a current stock cell.');
    return {
      itemId: cell.itemId,
      labId: cell.labId,
      locationId: cell.locationId,
      expectedVersion: cell.version,
    };
  }
  async function confirmApproval() {
    if (!approve) return;
    setApproveBusy(true);
    setApproveError('');
    try {
      approvalCommands.current[approve.id] ??= commandId();
      await inventoryWrite(
        `adjustments/${encodeURIComponent(approve.id)}/approve`,
        { commandId: approvalCommands.current[approve.id] },
        session.csrfToken
      );
      setApprove(null);
      onSaved();
    } catch (error) {
      setApproveError(
        error instanceof ApiError && error.status === 409
          ? 'Stock changed. Reload the proposal and review again.'
          : error instanceof Error
            ? error.message
            : 'Outcome unknown. Reload history before retrying.'
      );
    } finally {
      setApproveBusy(false);
    }
  }
  return (
    <div className="grid gap-4 officer-stock-layout">
      <>
        {technical && (
          <div className="officer-columns">
            <section className="officer-stock-shortcuts">
              <h2>Common stock operations</h2>
              <p className="muted">No self-approval of stock adjustments</p>
              {[
                {
                  title: 'Record stock receipt',
                  help: 'Increase recorded stock with receipt evidence',
                  action: () => setReceiptOpen(true),
                },
                {
                  title: 'Identify physical asset',
                  help: 'Select returnable stock below to register an asset ID',
                  action: () => document.getElementById('stock-cell')?.focus(),
                },
                {
                  title: 'Propose stock adjustment',
                  help: 'Select Available stock below; independent approval is required',
                  action: () => document.getElementById('stock-cell')?.focus(),
                },
              ].map((task) => (
                <div className="officer-priority" key={task.title}>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.help}</small>
                  </div>
                  <Button variant="outline" size="sm" onClick={task.action}>
                    Open
                  </Button>
                </div>
              ))}
            </section>
            <section className="officer-stock-shortcuts">
              <h2>Recent inventory activity</h2>
              <p className="muted">Inventory movements in your assigned laboratories</p>
              {recent.error && <ErrorNotice message={recent.error} />}
              {!recent.data && !recent.error && <p role="status">Loading recorded movements...</p>}
              {recent.data?.items.length === 0 && <OfficerEmpty area="activity" />}
              {recent.data?.items.slice(0, 5).map((m) => (
                <div className="officer-priority" key={m.id}>
                  <span>
                    <strong>{stockLabel(m.kind)}</strong>
                    <small>{m.reason}</small>
                  </span>
                  <time>{new Date(m.createdAt).toLocaleString('en-GB')}</time>
                </div>
              ))}
            </section>
          </div>
        )}
      </>
      {itemLookup.error && <ErrorNotice message={itemLookup.error} />}{' '}
      {stock.error && <ErrorNotice message={stock.error} />}
      <section className="records p-4">
        <h2>Stock by location</h2>
        <label htmlFor="cell-location">Filter loaded stock by location</label>
        <select
          id="cell-location"
          className={selectionClass}
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
        >
          <option value="">All loaded locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <p className="muted">
          Live balances for your authorized laboratories. Select an available stock cell below to
          record a receipt, adjustment or condition change.
        </p>
        {!stock.data && !stock.error && <p role="status">Loading stock...</p>}
        <>
          {stock.data &&
          stock.data.items.filter((row) => !locationFilter || row.locationId === locationFilter)
            .length > 0 ? (
            <div
              className="table-region"
              role="region"
              aria-label="Stock cells, scroll for all columns"
              tabIndex={0}
            >
              <Table>
                <TableCaption>Server stock balances and concurrency versions.</TableCaption>
                <TableHeader>
                  <TableRow>
                    {['Item', 'Laboratory / location', 'State', 'Quantity', 'Version'].map(
                      (value) => (
                        <TableHead key={value}>{value}</TableHead>
                      )
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.data?.items
                    .filter((row) => !locationFilter || row.locationId === locationFilter)
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {items.find((item) => item.id === row.itemId)?.name ?? row.itemId}
                        </TableCell>
                        <TableCell>
                          {labs.find((lab) => lab.id === row.labId)?.name ?? row.labId} /{' '}
                          {locations.find((location) => location.id === row.locationId)?.name ??
                            row.locationId}
                        </TableCell>
                        <TableCell>{stockLabel(row.state)}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{row.version}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : stock.data ? (
            <OfficerEmpty
              area="stock"
              filtered={Boolean(locationFilter)}
              onReset={() => setLocationFilter('')}
              onAction={() => setReceiptOpen(true)}
              action="Record stock receipt"
            />
          ) : null}
        </>
      </section>
      {technical && (
        <>
          <Button className="justify-self-start" onClick={() => setReceiptOpen(true)}>
            Receive stock
          </Button>
          <ReceiveItemsDialog open={receiptOpen} onOpenChange={setReceiptOpen}
            session={session} labs={labs} locations={locations} onSaved={onSaved} />
          <section className="border bg-white p-4">
            <h2>Select equipment and location</h2>
            <label htmlFor="stock-cell">Equipment / location / stock state</label>
            <select
              id="stock-cell"
              className={selectionClass}
              value={cellId}
              onChange={(event) => setCellId(event.target.value)}
            >
              <option value="">Choose equipment and location</option>
              {stock.data?.items
                .filter((row) => ['AVAILABLE', 'INSPECTION', 'MAINTENANCE'].includes(row.state))
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {items.find((item) => item.id === row.itemId)?.name ?? row.itemId} /{' '}
                    {locations.find((location) => location.id === row.locationId)?.name ??
                      row.locationId}{' '}
                    / {stockLabel(row.state)} / v{row.version}
                  </option>
                ))}
            </select>
          </section>
          {cell && (
            <div key={cell.id + ':' + cell.version} className="grid gap-4 md:grid-cols-2">
              {cell.state === 'AVAILABLE' && !cell.assetId && (
                <MutationForm
                  title="Propose stock adjustment"
                  path="adjustments"
                  context={
                    <>
                      {stockContext}
                      <p>Create a proposal only. Stock changes require independent approval.</p>
                    </>
                  }
                  session={session}
                  onSaved={onSaved}
                  build={(data) => ({
                    ...cellBody(),
                    quantity: Number(data.get('adjustQuantity')),
                    direction: data.get('direction'),
                    reason: data.get('reason'),
                  })}
                >
                  <p>
                    Anonymous AVAILABLE correction only; separate administrator approval is
                    required.
                  </p>
                  <TextField name="adjustQuantity" label="Adjustment quantity" type="number" />
                  <div>
                    <label htmlFor="direction">Direction</label>
                    <select id="direction" name="direction" className={selectionClass}>
                      <option value="ADD">Add</option>
                      <option value="REMOVE">Remove</option>
                    </select>
                  </div>
                  <TextField name="reason" label="Adjustment reason" />
                </MutationForm>
              )}
              {cell.state === 'AVAILABLE' &&
                !cell.assetId &&
                items.find((item) => item.id === cell.itemId)?.kind === 'RETURNABLE' && (
                  <MutationForm
                    title="Identify physical asset"
                    path="assets"
                    context={
                      <>
                        {stockContext}
                        <p>
                          Identify exactly 1 anonymous Available unit. Total stock does not
                          increase.
                        </p>
                      </>
                    }
                    session={session}
                    onSaved={onSaved}
                    build={(data) => ({
                      ...cellBody(),
                      ...(String(data.get('serial')).trim()
                        ? { serial: String(data.get('serial')).trim() }
                        : {}),
                    })}
                  >
                    <p>
                      Converts one anonymous AVAILABLE returnable unit. Does not add stock. Server
                      assigns the permanent identifier. Consumables cannot be materialized.
                    </p>
                    <TextField name="serial" label="Serial number (optional)" required={false} />
                  </MutationForm>
                )}
              {!inspectionWorkflow &&
                !technical &&
                items.find((item) => item.id === cell.itemId)?.kind === 'RETURNABLE' && (
                  <MutationForm
                    title="Update equipment condition"
                    path="stock"
                    session={session}
                    onSaved={onSaved}
                    build={(data) => ({
                      ...cellBody(),
                      fromState: cell.state,
                      toState: data.get('toState'),
                      quantity: Number(data.get('stateQuantity')),
                      ...(cell.assetId ? { assetId: cell.assetId } : {}),
                    })}
                  >
                    <p>
                      Only AVAILABLE, INSPECTION and MAINTENANCE. Identified assets require quantity
                      1.
                    </p>
                    <div>
                      <label htmlFor="toState">Destination state</label>
                      <select id="toState" name="toState" className={selectionClass}>
                        {['AVAILABLE', 'INSPECTION', 'MAINTENANCE']
                          .filter((state) => state !== cell.state)
                          .map((state) => (
                            <option key={state} value={state}>
                              {stockLabel(state)}
                            </option>
                          ))}
                      </select>
                    </div>
                    <TextField name="stateQuantity" label="State movement quantity" type="number" />
                    <p>Asset: {cell.assetId ?? 'Anonymous stock'}</p>
                  </MutationForm>
                )}
            </div>
          )}
        </>
      )}
      {adjustments.error && <ErrorNotice message={adjustments.error} />}
      <section className="records p-4">
        <h2>Adjustment proposals</h2>
        {!adjustments.data && !adjustments.error && <p role="status">Loading proposals...</p>}
        {adjustments.data?.items.map((row) => (
          <div key={row.id} className="border-b py-4">
            <p>
              {row.direction} {row.quantity} / {row.reason} / {stockLabel(row.state)}
            </p>
            <p className="muted">Proposer {row.proposer}</p>
            {admin && (
              <Button
                variant="outline"
                disabled={row.proposer === session.user.id || row.state !== 'PENDING'}
                onClick={() => {
                  setApprove(row);
                  setApproveError('');
                }}
              >
                Review independent approval
              </Button>
            )}
          </div>
        ))}
        {adjustments.data && !adjustments.data.items.length && <OfficerEmpty area="proposals" />}
      </section>
      <Dialog
        open={approve !== null}
        onOpenChange={(open) => {
          if (!open && !approveBusy) setApprove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm independent stock adjustment</DialogTitle>
            <DialogDescription>
              Review the proposer, reason and correction. You must differ from the proposer. The
              server rechecks authority and stock version.
            </DialogDescription>
          </DialogHeader>
          <p>
            {approve?.direction} {approve?.quantity} / {approve?.reason}
          </p>
          {approveError && <ErrorNotice message={approveError} />}
          <ConfirmedAction
            title="Approve stock adjustment"
            disabled={approveBusy}
            onConfirmed={confirmApproval}
            summary={[
              {
                label: 'Item',
                value: items.find((i) => i.id === approve?.itemId)?.name ?? approve?.itemId ?? '',
              },
              { label: 'Proposal', value: approve?.id ?? '' },
              {
                label: 'Quantity / direction',
                value: `${approve?.quantity} / ${approve?.direction}`,
              },
              { label: 'Proposer', value: approve?.proposer ?? '' },
              { label: 'Reason', value: approve?.reason ?? '' },
            ]}
          >
            Approve reviewed correction
          </ConfirmedAction>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function ImportPanel({ session, onSaved }: { session: Session; onSaved: () => void }) {
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [stageRevision, setStageRevision] = useState(0);
  const stages = useInventoryLookup<{
    id: string;
    committed: boolean;
    rowCount: number;
  }>('imports', stageRevision);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const pending = useRef<{ payload: string; id: string } | null>(null);
  const commitId = useRef<string | null>(null);
  const commitStage = useRef<string | null>(null);
  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File)) return;
    if (commitId.current) {
      setError(
        'A commit result is unresolved. Retry the original commit or check import status before uploading another file.'
      );
      return;
    }
    setBusy(true);
    setError('');
    setIssues([]);
    setPreview(null);
    setSuccess('');
    try {
      if (file.size > (file.name.toLowerCase().endsWith('.xlsx') ? 512000 : 700000))
        throw new Error(
          'File exceeds server limits: XLSX 512000 bytes; CSV 700000 bytes; at most 100 rows.'
        );
      const format = file.name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'CSV';
      const content =
        format === 'CSV'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(',')[1]);
              reader.onerror = () => reject(new Error('Cannot read selected file.'));
              reader.readAsDataURL(file);
            });
      const payload = JSON.stringify({ format, content });
      if (!pending.current || pending.current.payload !== payload)
        pending.current = { payload, id: commandId() };
      setPreview(
        await inventoryWrite<Preview>(
          'imports/preview',
          { commandId: pending.current.id, format, content },
          session.csrfToken
        )
      );
      commitId.current = null;
      setStageRevision((value) => value + 1);
    } catch (error) {
      if (error instanceof InventoryError) setIssues(error.issues);
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to validate file. No client-side acceptance substitutes server validation.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function reopen(id: string) {
    if (commitId.current && commitStage.current !== id) {
      setError('Resolve the original import commit before opening another stage.');
      return;
    }
    setBusy(true);
    setError('');
    setIssues([]);
    setSuccess('');
    setPreview(null);
    try {
      const stored = await inventoryRead<Preview>(`imports/${encodeURIComponent(id)}`);
      if (
        stored.id !== id ||
        typeof stored.committed !== 'boolean' ||
        !Array.isArray(stored.rows) ||
        stored.rowCount !== stored.rows.length
      )
        throw new Error('The saved preview response is incomplete. No commit is available.');
      setPreview(stored);
      if (stored.committed) {
        commitId.current = null;
        commitStage.current = null;
        setSuccess('This import is already committed. Rows are shown for review only.');
      }
      requestAnimationFrame(() => previewHeading.current?.focus());
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 404
          ? 'Saved preview unavailable in your current scope. No commit is available.'
          : error instanceof Error
            ? error.message
            : 'Unable to reopen saved preview.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || preview.committed) return;
    setBusy(true);
    setError('');
    try {
      commitId.current ??= commandId();
      commitStage.current = preview.id;
      await inventoryWrite(
        `imports/${encodeURIComponent(preview.id)}/commit`,
        { commandId: commitId.current },
        session.csrfToken
      );
      setSuccess(
        'Server committed the staged receipts. Reload stock history for the recorded effects.'
      );
      setPreview(null);
      pending.current = null;
      commitId.current = null;
      commitStage.current = null;
      setStageRevision((value) => value + 1);
      onSaved();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 409
      )
        pending.current = null;
      setError(
        error instanceof ApiError && error.status === 409
          ? 'Import conflicts with current stock. Review history before staging a new file.'
          : error instanceof Error
            ? error.message
            : 'Commit outcome unknown. Check the original staged import; do not upload another copy.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border bg-white rounded-md p-4">
      <h2>Receipt import workflow</h2>
      <p className="muted">Controlled, auditable inventory receipt imports</p>
      <ol className="officer-flow" aria-label="Receipt import steps">
        {['Upload CSV/XLSX', 'Validate', 'Preview', 'Commit'].map((step, index) => (
          <li
            key={step}
            aria-current={
              preview ? (index === 2 ? 'step' : undefined) : index === 0 ? 'step' : undefined
            }
          >
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      {issues.length > 0 && (
        <div
          className="table-region"
          role="region"
          tabIndex={0}
          aria-label="Server import validation errors"
        >
          <Table>
            <TableCaption>
              Row 0 means file-level error. Row numbers are returned by the server.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Validation code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
                <TableRow key={index}>
                  <TableCell>{issue.row}</TableCell>
                  <TableCell>{issue.column}</TableCell>
                  <TableCell>{issue.code.replaceAll('_', ' ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p>
        CSV or XLSX, up to 100 rows. Exact columns: itemId, labId, locationId, quantity, provenance.
        Server validates and stores the preview; commit revalidates every row atomically.
      </p>
      {error && <ErrorNotice message={error} />}
      <p role="status">{success}</p>
      <form onSubmit={validate} className="grid gap-4 my-4">
        <label htmlFor="file">Receipt file</label>
        <Input id="file" name="file" type="file" accept=".csv,.xlsx" required disabled={busy} />
        <Button disabled={busy} type="submit">
          {busy ? 'Checking server result...' : 'Upload and validate preview'}
        </Button>
      </form>
      {preview && (
        <>
          <h2 ref={previewHeading} tabIndex={-1}>
            Server-staged preview: {preview.rowCount} rows
          </h2>
          <div
            className="table-region"
            role="region"
            tabIndex={0}
            aria-label="Validated import rows"
          >
            <Table>
              <TableCaption>
                Server preview {preview.id}. Review all rows before committing.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {['Row', 'Item', 'Lab', 'Location', 'Quantity', 'Provenance'].map((name) => (
                    <TableHead key={name}>{name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    {['itemId', 'labId', 'locationId', 'quantity', 'provenance'].map((key) => (
                      <TableCell key={key}>{String(row[key] ?? '')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {preview.committed ? (
            <p role="status">Committed import - read-only receipt rows.</p>
          ) : (
            <ConfirmedAction
              title="Commit receipt import"
              disabled={busy}
              onConfirmed={commit}
              summary={[
                { label: 'Staged import', value: preview.id },
                { label: 'Rows', value: String(preview.rowCount) },
              ]}
              context={
                <div className="table-region">
                  <Table>
                    <TableCaption>Exact staged receipt rows to commit atomically</TableCaption>
                    <TableHeader>
                      <TableRow>
                        {['Item', 'Laboratory', 'Location', 'Quantity', 'Receipt reference'].map(
                          (h) => (
                            <TableHead key={h}>{h}</TableHead>
                          )
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, index) => (
                        <TableRow key={index}>
                          {['itemId', 'labId', 'locationId', 'quantity', 'provenance'].map(
                            (key) => (
                              <TableCell key={key}>{String(row[key] ?? '')}</TableCell>
                            )
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              }
            >
              Commit reviewed receipt rows
            </ConfirmedAction>
          )}
        </>
      )}
      <section className="mt-6 border-t pt-4">
        <h2>My staged imports</h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => setStageRevision((value) => value + 1)}
        >
          Refresh import status
        </Button>
        {stages.error && <ErrorNotice message={stages.error} />}{' '}
        {!stages.data && !stages.error && <p role="status">Loading stages...</p>}
        {stages.data?.items.length === 0 && <OfficerEmpty area="imports" />}
        {stages.data?.items.map((stage) => (
          <div key={stage.id} className="border-b py-3 flex flex-wrap items-center gap-3">
            <p>
              {stage.id} / {stage.rowCount} rows /{' '}
              {stage.committed ? 'Committed' : 'Awaiting commit'}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => reopen(stage.id)}
              aria-label={`Reopen preview ${stage.id}`}
            >
              Reopen preview
            </Button>
          </div>
        ))}
        <p className="muted">
          Reopen fetches the saved rows under your current permissions. Review those rows before
          committing the existing stage. Committed stages are read only.
        </p>
      </section>
    </section>
  );
}
