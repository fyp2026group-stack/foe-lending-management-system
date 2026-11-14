'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api, type Session } from '@/components/identity/api';
import { ErrorNotice } from '@/components/identity/session';
import { inventoryRead, type Named } from '@/components/inventory/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { lendingRead, type BorrowRequest, type Metrics, type Page } from './api';
import { useLending } from './shared';

type Choices = { labs: Named[]; batches: Named[] };
const selectClass = 'min-h-11 border rounded-md bg-white px-3 w-full';
export function LendingMetrics({ session, revision = 0 }: { session: Session; revision?: number }) {
  return session.user.roles.some((role) => ['ADMIN', 'TECHNICAL_OFFICER'].includes(role)) ? (
    <MetricsPanel session={session} revision={revision} />
  ) : null;
}
function MetricsPanel({ session, revision }: { session: Session; revision: number }) {
  const [path, setPath] = useState('metrics');
  const [filterError, setFilterError] = useState('');
  const [reload, setReload] = useState(0);
  const [lookup, setLookup] = useState<{ key: string; data?: Choices; error?: string }>();
  const admin = session.user.roles.includes('ADMIN');
  const key = session.user.id + ':' + revision + ':' + admin;
  const result = useLending<Metrics>(path, revision + reload);
  useEffect(() => {
    const controller = new AbortController();
    async function load(): Promise<Choices> {
      if (admin) {
        const [labs, batches] = await Promise.all([
          api<Page<Named>>('/api/admin/laboratories', { signal: controller.signal }),
          api<Page<Named>>('/api/admin/batches', { signal: controller.signal }),
        ]);
        return { labs: labs.items, batches: batches.items };
      }
      const locations: Named[] = [];
      for (let offset = 0; offset <= 10000; offset += 100) {
        const page = await inventoryRead<Page<Named>>(
          `locations?limit=100&offset=${offset}`,
          controller.signal
        );
        locations.push(...page.items);
        if (page.items.length < 100) break;
        if (offset === 10000) throw new Error('Too many laboratory choices to load.');
      }
      const requests = await lendingRead<Page<BorrowRequest>>('requests', controller.signal);
      const labIds = Array.from(
        new Set(locations.flatMap((location) => (location.labId ? [location.labId] : [])))
      );
      const labs = labIds.map((id) => ({
        id,
        name:
          'Locations: ' +
          locations
            .filter((location) => location.labId === id)
            .map((location) => location.name)
            .join(', '),
      }));
      const batchIds = Array.from(
        new Set(requests.items.flatMap((request) => (request.batchId ? [request.batchId] : [])))
      );
      const batches = batchIds.map((id) => ({
        id,
        name:
          'Borrowers: ' +
          Array.from(
            new Set(
              requests.items
                .filter((request) => request.batchId === id)
                .map((request) => request.borrower)
            )
          ).join(', '),
      }));
      return { labs, batches };
    }
    load()
      .then((data) => {
        if (!controller.signal.aborted) setLookup({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLookup({
            key,
            error: error instanceof Error ? error.message : 'Unable to load scope choices.',
          });
      });
    return () => controller.abort();
  }, [admin, key]);
  const choices = lookup?.key === key ? lookup : undefined;
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError('');
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    try {
      for (const name of ['labId', 'batchId']) {
        const value = String(data.get(name) || '');
        if (value) params.set(name, value);
      }
      for (const name of ['from', 'to']) {
        const value = String(data.get(name) || '');
        if (value) {
          const instant = new Date(value);
          if (!Number.isFinite(instant.getTime()))
            throw new Error('Choose valid date and time filters.');
          params.set(name, instant.toISOString());
        }
      }
      const from = params.get('from');
      const to = params.get('to');
      if (from && to && new Date(from).getTime() >= new Date(to).getTime())
        throw new Error('The end date must be later than the start date.');
      setPath('metrics' + (params.size ? '?' + params.toString() : ''));
      setReload((value) => value + 1);
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : 'Unable to apply filters.');
    }
  }
  return (
    <Card className="metrics-panel my-4">
      <div className="metrics-heading">
        <div>
          <p className="eyebrow">LIVE OPERATIONS</p>
          <h2>Lending overview</h2>
        </div>
        <span>Current lending activity</span>
      </div>
      <p className="muted metrics-description">
        Filter activity by laboratory, academic batch and issue dates. The end time is excluded.
      </p>
      {choices?.error && <ErrorNotice message={choices.error} />}
      {!choices && <p role="status">Loading laboratory and batch filters...</p>}
      <form className="grid gap-3 my-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={apply}>
        <label>
          Laboratory
          <select name="labId" className={selectClass} disabled={!choices?.data}>
            <option value="">All authorized laboratories</option>
            {choices?.data?.labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Academic batch
          <select name="batchId" className={selectClass} disabled={!choices?.data}>
            <option value="">All authorized batches</option>
            {choices?.data?.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Issued from (local time)
          <Input name="from" type="datetime-local" />
        </label>
        <label>
          Issued before (local time)
          <Input name="to" type="datetime-local" />
        </label>
        <div className="flex gap-2 items-end">
          <Button type="submit">Apply filters</Button>
          <Button
            type="reset"
            variant="outline"
            onClick={() => {
              setPath('metrics');
              setFilterError('');
              setReload((value) => value + 1);
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      {!admin && (
        <p className="muted">
          Laboratory choices list your assigned stock locations. Batch choices list borrowers from
          requests visible to you.
        </p>
      )}
      {filterError && <ErrorNotice message={filterError} />}
      {result.error && <ErrorNotice message={result.error} />}
      {!result.data && !result.error && <p role="status">Loading lending metrics...</p>}
      {result.data && (
        <>
          <dl className="metric-grid" aria-live="polite">
            {(
              [
                ['Borrowed Equipment', result.data.metrics.loans],
                ['Handed-over units', result.data.metrics.issuedQuantity],
                ['Outstanding units', result.data.metrics.outstandingQuantity],
                ['Overdue Borrowed Equipment', result.data.metrics.overdueLoans],
              ] as const
            ).map(([label, value]) => (
              <div className="metric" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {result.data.metrics.loans === 0 && (
            <p role="status">No borrowing records match this scope and date range.</p>
          )}
        </>
      )}
    </Card>
  );
}
