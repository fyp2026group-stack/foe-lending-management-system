'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, type Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/module-tabs';
import { ReviewSheet } from '@/components/ui/review-sheet';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { commandId, inventoryWrite, InventoryError, type Item, type Named } from './api';
import { definitionPayload } from './catalogue-model';
import { useInventoryLookup } from './lookups';

type Resource = 'items' | 'categories' | 'locations';
const labels: Record<Resource, string> = {
  items: 'catalogue item',
  categories: 'category',
  locations: 'stock location',
};
type EditorProps = {
  resource: Resource;
  record?: Named | Item;
  session: Session;
  categories: Named[];
  labs: Named[];
  onClose: () => void;
  onSaved: () => void;
};

export function DefinitionEditor({
  resource,
  record,
  session,
  categories,
  labs,
  onClose,
  onSaved,
}: EditorProps) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stale, setStale] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [intent, setIntent] = useState<'save' | 'deactivate'>('save');
  const pending = useRef<{ body: Record<string, unknown>; id: string } | null>(null);
  const item = record && 'kind' in record ? record : undefined;
  const [specifications, setSpecifications] = useState<{ key: string; value: string }[]>(() =>
    Object.entries(item?.specifications ?? {}).map(([key, value]) => ({ key, value }))
  );
  const versioned = !record || Number.isInteger(record.version);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const payload: Record<string, unknown> = {
        name: String(data.get('name') ?? '').trim(),
        ...(record ? { expectedVersion: record.version } : {}),
      };
      if (resource === 'items')
        Object.assign(payload, {
          categoryId: data.get('categoryId'),
          kind: data.get('kind'),
          uom: String(data.get('uom') ?? '').trim(),
        });
      if (resource === 'items') {
        if (
          specifications.some((row) => !row.key.trim()) ||
          new Set(specifications.map((row) => row.key.trim())).size !== specifications.length
        )
          throw new Error('Give every specification a unique name.');
        const specs = Object.fromEntries(specifications.map((row) => [row.key.trim(), row.value]));
        if (JSON.stringify(specs) !== JSON.stringify(item?.specifications ?? {}))
          payload.specifications = specs;
      }
      if (resource === 'locations' && !record) payload.labId = data.get('labId');
      if (record) payload.active = intent === 'deactivate' ? false : data.get('active') === 'true';
      if (!pending.current)
        pending.current = {
          body: definitionPayload(resource, record, payload, intent === 'deactivate'),
          id: commandId(),
        };
      await inventoryWrite(
        resource + (record ? '/' + encodeURIComponent(record.id) : ''),
        { ...pending.current.body, commandId: pending.current.id },
        session.csrfToken,
        record ? 'PATCH' : 'POST'
      );
      pending.current = null;
      setUncertain(false);
      setSuccess(
        intent === 'deactivate'
          ? 'Record deactivated. History has been retained.'
          : 'Catalogue changes saved.'
      );
      onSaved();
    } catch (cause) {
      const staleVersion = cause instanceof InventoryError && cause.code === 'STALE_VERSION';
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        pending.current = null;
        setUncertain(false);
        if (staleVersion) setStale(true);
      } else setUncertain(pending.current !== null);
      setError(
        staleVersion
          ? 'This record changed. Close this form, refresh records and review the latest version before editing.'
          : cause instanceof Error
            ? cause.message
            : 'Unable to confirm the result. Retry the same operation to reconcile it.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ReviewSheet
      open
      onOpenChange={(open) => {
        if (!open && !busy && !uncertain) onClose();
      }}
      title={`${record ? 'Edit' : 'Create'} ${labels[resource]}`}
      description="Catalogue changes are saved to the database. Existing stock and movement history remain linked to this record."
    >
      {!versioned && (
        <p role="status" className="catalogue-contract-notice">
          Editing is unavailable until the server supplies a current catalogue version. Refresh
          records after the catalogue update is deployed.
        </p>
      )}
      {error && <ErrorNotice message={error} />}
      {success ? (
        <div role="status">
          <p>{success}</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form className="definition-form" onSubmit={submit}>
          <fieldset disabled={busy || stale || !versioned || uncertain}>
            <div className="definition-name">
              <label htmlFor={uid + '-name'}>Name</label>
              <Input
                id={uid + '-name'}
                name="name"
                required
                maxLength={120}
                defaultValue={record?.name}
              />
            </div>
            {resource === 'items' && (
              <>
                <div>
                  <label htmlFor={uid + '-category'}>Category</label>
                  <select
                    id={uid + '-category'}
                    name="categoryId"
                    required
                    defaultValue={item?.categoryId ?? ''}
                  >
                    <option value="">Choose category</option>
                    {categories
                      .filter((c) => c.active !== false || c.id === item?.categoryId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.active === false ? ' (inactive)' : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={uid + '-kind'}>Type</label>
                  <select id={uid + '-kind'} name="kind" defaultValue={item?.kind ?? 'RETURNABLE'}>
                    <option value="RETURNABLE">Returnable equipment</option>
                    <option value="CONSUMABLE">Consumable</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={uid + '-uom'}>Unit of measure</label>
                  <Input
                    id={uid + '-uom'}
                    name="uom"
                    required
                    maxLength={40}
                    defaultValue={item?.uom}
                    placeholder="e.g. unit, box, litre"
                  />
                </div>
                <fieldset className="specification-fields">
                  <legend>Specifications (optional)</legend>
                  {specifications.map((row, index) => (
                    <div className="specification-row" key={index}>
                      <div>
                        <label htmlFor={uid + '-spec-key-' + index}>
                          Specification {index + 1}
                        </label>
                        <Input
                          id={uid + '-spec-key-' + index}
                          required
                          maxLength={80}
                          value={row.key}
                          placeholder="e.g. Measurement range"
                          onChange={(event) =>
                            setSpecifications((current) =>
                              current.map((spec, i) =>
                                i === index ? { ...spec, key: event.target.value } : spec
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor={uid + '-spec-value-' + index}>Value</label>
                        <Input
                          id={uid + '-spec-value-' + index}
                          maxLength={500}
                          value={row.value}
                          onChange={(event) =>
                            setSpecifications((current) =>
                              current.map((spec, i) =>
                                i === index ? { ...spec, value: event.target.value } : spec
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remove specification ${index + 1}`}
                        onClick={() =>
                          setSpecifications((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={specifications.length >= 30}
                    onClick={() =>
                      setSpecifications((current) => [...current, { key: '', value: '' }])
                    }
                  >
                    Add specification
                  </Button>
                </fieldset>
              </>
            )}
            {resource === 'locations' && (
              <div>
                <label htmlFor={uid + '-lab'}>Laboratory</label>
                <select
                  id={uid + '-lab'}
                  name="labId"
                  required
                  disabled={Boolean(record)}
                  defaultValue={record?.labId ?? ''}
                >
                  <option value="">Choose laboratory</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {record && (
              <div>
                <label htmlFor={uid + '-active'}>Catalogue status</label>
                <select
                  id={uid + '-active'}
                  name="active"
                  defaultValue={String(record.active !== false)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </fieldset>
          {record && (
            <p className="muted">
              Deactivation retains this record and its history. Records with live stock or pending
              requests cannot be deactivated. Units and item type cannot change after stock history
              is recorded.
            </p>
          )}
          {uncertain && (
            <p role="status">
              The result is unconfirmed. Retry the same operation before closing this form.
            </p>
          )}
          <div className="definition-actions">
            <Button
              disabled={busy || stale || !versioned}
              type="submit"
              onClick={() => {
                if (!uncertain) setIntent('save');
              }}
            >
              {busy ? 'Saving…' : uncertain ? 'Retry original operation' : 'Save changes'}
            </Button>
            {record && record.active !== false && !uncertain && (
              <Button
                variant="destructive"
                disabled={busy || stale || !versioned}
                type="submit"
                onClick={() => setIntent('deactivate')}
              >
                Deactivate record
              </Button>
            )}
            <Button type="button" variant="outline" disabled={busy || uncertain} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </ReviewSheet>
  );
}

export function Definitions({
  session,
  categories,
  locations,
  labs,
  onSaved,
  revision,
  mode = 'all',
}: {
  session: Session;
  categories: Named[];
  locations: Named[];
  labs: Named[];
  onSaved: () => void;
  revision: number;
  mode?: 'all' | 'categoriesAndLocations';
}) {
  const [resource, setResource] = useState<Resource>(mode === 'categoriesAndLocations' ? 'categories' : 'items');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ resource: Resource; record?: Named | Item } | null>(null);
  const items = useInventoryLookup<Item>('items', revision);
  const records =
    resource === 'items'
      ? (items.data?.items ?? [])
      : resource === 'categories'
        ? categories
        : locations;
  const rows = records
    .filter((record) => record.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="records">
      <div className="section-heading">
        <div>
          <h2>{mode === 'categoriesAndLocations' ? 'Categories & storage locations' : 'Catalogue setup'}</h2>
          <p className="muted">{mode === 'categoriesAndLocations'
            ? 'Organize equipment categories and the places where items are stored.'
            : 'Maintain items, categories and physical stock locations.'}</p>
        </div>
        <Button onClick={() => setEditor({ resource })}>Add {labels[resource]}</Button>
      </div>
      <Tabs
        value={resource}
        onValueChange={(value) => {
          setResource(value as Resource);
          setQuery('');
        }}
        label="Catalogue definitions"
        items={mode === 'categoriesAndLocations'
          ? [{ value: 'categories', label: 'Categories' }, { value: 'locations', label: 'Locations' }]
          : [{ value: 'items', label: 'Items' }, { value: 'categories', label: 'Categories' }, { value: 'locations', label: 'Locations' }]}
      >
        <label className="record-search">
          Search {labels[resource]} records
          <Input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} />
        </label>
        {items.error && <ErrorNotice message={items.error} />}
        {resource === 'items' && !items.data && !items.error ? (
          <p role="status" className="empty-state">
            Loading catalogue definitions…
          </p>
        ) : (
          <>
            <div
              className="table-region"
              role="region"
              tabIndex={0}
              aria-label="Catalogue definitions"
            >
              <Table>
                <TableCaption>
                  {rows.length} matching records. Deactivation retains history.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Name</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Context</TableHead>
                    <TableHead scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {record.active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {'kind' in record
                          ? record.kind === 'RETURNABLE'
                            ? 'Returnable equipment'
                            : 'Consumable'
                          : record.labId
                            ? (labs.find((l) => l.id === record.labId)?.name ?? 'Laboratory')
                            : 'Category'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          onClick={() => setEditor({ resource, record })}
                          aria-label={`Edit ${record.name}`}
                        >
                          Edit / deactivate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!rows.length && (
              <p role="status" className="empty-state">
                No matching definitions.
              </p>
            )}
          </>
        )}
      </Tabs>
      {editor && (
        <DefinitionEditor
          key={editor.resource + ':' + (editor.record?.id ?? 'new')}
          {...editor}
          session={session}
          categories={categories}
          labs={labs}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
