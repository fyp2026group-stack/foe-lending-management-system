'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api, readRows, type RecordRow } from '@/components/identity/api';
import { useInventoryLookup } from '@/components/inventory/lookups';
import type { Item, Named } from '@/components/inventory/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReportRecordPicker, type ReportOption } from './report-record-picker';

type ReportName = 'borrowing' | 'overdue' | 'inventory' | 'approvals' | 'audit';
type Directory = { users: RecordRow[]; batches: RecordRow[]; laboratories: RecordRow[] };
const labels: Record<string, string> = {
  status: 'Status / event', stage: 'Approval stage', kind: 'Equipment type',
  from: 'From date', to: 'To date', batchId: 'Academic batch',
  labId: 'Laboratory', categoryId: 'Category', itemId: 'Equipment',
  borrowerId: 'Borrower', lecturerId: 'Lecturer', officerId: 'Technical officer',
};
const statusOptions: Record<ReportName, string[]> = {
  borrowing: ['BORROWED', 'OVERDUE', 'RETURNED'],
  overdue: [],
  inventory: [],
  approvals: ['APPROVE', 'REJECT'],
  audit: [],
};
const format = (text: string) =>
  text.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');

export function ReportFilters({
  filters, setFilters, audit, report,
}: {
  filters: Record<string, string>;
  setFilters: (filters: Record<string, string>) => void;
  audit: boolean;
  report: ReportName;
}) {
  const [draft, setDraft] = useState(filters);
  const [directory, setDirectory] = useState<Directory>();
  const [directoryError, setDirectoryError] = useState('');
  const items = useInventoryLookup<Item>('items', 0);
  const categories = useInventoryLookup<Named>('categories', 0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      (['users', 'batches', 'laboratories'] as const).map((name) =>
        api<unknown>('/api/admin/' + name, { signal: controller.signal }).then(readRows)
      )
    ).then(([users, batches, laboratories]) => {
      if (!controller.signal.aborted) setDirectory({ users, batches, laboratories });
    }).catch((e) => {
      if (!controller.signal.aborted)
        setDirectoryError(e instanceof Error ? e.message : 'Report options unavailable.');
    });
    return () => controller.abort();
  }, []);
  const set = (name: string, value: string) => setDraft((previous) => ({ ...previous, [name]: value }));
  const people = directory?.users ?? [];
  const optionMap: Record<string, ReportOption[]> = {
    batchId: (directory?.batches ?? []).map((item) => ({ value: item.id, label: item.name ?? item.id })),
    labId: (directory?.laboratories ?? []).map((item) => ({ value: item.id, label: item.name ?? item.id })),
    categoryId: (categories.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
    itemId: (items.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
    borrowerId: people.map((item) => ({
      value: item.id,
      label: (item.displayName ?? item.email ?? item.id) + (item.registrationNumber ? ' · ' + item.registrationNumber : ''),
    })),
    lecturerId: people.filter((item) => item.roles?.includes('LECTURER')).map((item) => ({ value: item.id, label: item.displayName ?? item.email ?? item.id })),
    officerId: people.filter((item) => item.roles?.includes('TECHNICAL_OFFICER')).map((item) => ({ value: item.id, label: item.displayName ?? item.email ?? item.id })),
  };
  const primary = audit
    ? ['status', 'from', 'to']
    : report === 'inventory'
      ? ['kind']
      : report === 'approvals'
        ? ['status', 'stage', 'from', 'to']
        : report === 'overdue'
          ? ['kind', 'from', 'to']
          : ['status', 'kind', 'from', 'to'];
  const advanced = audit
    ? []
    : report === 'inventory'
      ? ['labId', 'categoryId', 'itemId']
      : report === 'approvals'
        ? ['batchId', 'labId', 'categoryId', 'itemId', 'borrowerId', 'lecturerId']
        : ['batchId', 'labId', 'categoryId', 'itemId', 'borrowerId', 'lecturerId', 'officerId'];
  function field(name: string) {
    if (optionMap[name]) return (
      <ReportRecordPicker
        key={name}
        label={labels[name]}
        value={draft[name] ?? ''}
        options={optionMap[name]}
        onChange={(value) => set(name, value)}
        loading={!directory && !items.data && !categories.data}
      />
    );
    const choices = name === 'stage'
      ? ['LECTURER', 'HOD']
      : name === 'kind'
        ? ['RETURNABLE', 'CONSUMABLE']
        : statusOptions[report];
    if (choices.length && name !== 'from' && name !== 'to') return (
      <label key={name} className="admin-filter-field">
        <span className="admin-filter-label">{labels[name]}</span>
        <Select value={draft[name] || '__all__'} onValueChange={(value) => set(name, value === '__all__' ? '' : value)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {choices.map((choice) => <SelectItem key={choice} value={choice}>{format(choice)}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
    );
    return (
      <label key={name} className="admin-filter-field">
        <span className="admin-filter-label">{labels[name]}</span>
        <Input
          type={name === 'from' || name === 'to' ? 'date' : 'text'}
          value={draft[name] ?? ''}
          onChange={(event) => set(name, event.target.value)}
          placeholder={name === 'status' ? 'Event code' : undefined}
        />
      </label>
    );
  }
  const apply = (event: FormEvent) => { event.preventDefault(); setFilters(draft); };
  return (
    <form className="admin-report-filter-form" onSubmit={apply}>
      <div className="admin-filterbar">
        {primary.map(field)}
        <Button type="submit">Apply filters</Button>
        <Button type="button" variant="outline" onClick={() => { setDraft({}); setFilters({}); }}>Clear</Button>
      </div>
      {!!advanced.length && (
        <details className="admin-advanced-filters">
          <summary>More filters</summary>
          <div>{advanced.map(field)}</div>
        </details>
      )}
      {directoryError && <p role="alert" className="p-3 text-sm text-destructive">Could not load people and laboratory filters: {directoryError}</p>}
      {(items.error || categories.error) && <p role="alert" className="p-3 text-sm text-destructive">Could not load equipment filter options.</p>}
    </form>
  );
}
