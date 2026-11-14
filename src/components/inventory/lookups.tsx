'use client';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryRead, type Item, type Page } from './api';
export function useInventoryLookup<T>(
  resource: string,
  revision: number
): { data?: { items: T[] }; error?: string } {
  const [state, setState] = useState<{ key: string; data?: { items: T[] }; error?: string }>();
  const key = resource + ':' + revision;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const items: T[] = [];
      for (let offset = 0; offset <= 10000; offset += 100) {
        const page = await inventoryRead<Page<T>>(
          `${resource}${resource.includes('?') ? '&' : '?'}limit=100&offset=${offset}`,
          controller.signal
        );
        items.push(...page.items);
        if (page.items.length < 100) return { items };
      }
      throw new Error('Lookup exceeds supported offset 10000. Narrow the scope before selecting.');
    }
    load()
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, error: error instanceof Error ? error.message : 'Lookup unavailable.' });
      });
    return () => controller.abort();
  }, [resource, key]);
  return state?.key === key ? state : {};
}
export function ItemPicker({ name, label }: { name: string; label: string }) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState<Item | null>(null);
  const [state, setState] = useState<{ key: string; items?: Item[]; error?: string }>();
  const path = `items?active=true&limit=20&offset=${offset}&q=${encodeURIComponent(query)}`;
  useEffect(() => {
    const controller = new AbortController();
    inventoryRead<Page<Item>>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key: path, items: data.items });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key: path,
            error: error instanceof Error ? error.message : 'Items unavailable.',
          });
      });
    return () => controller.abort();
  }, [path]);
  const current = state?.key === path ? state : undefined;
  return (
    <fieldset className="border p-3 grid gap-2">
      <legend>{label}</legend>
      <label htmlFor={uid}>Search catalogue items</label>
      <Input
        id={uid}
        maxLength={120}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOffset(0);
        }}
      />
      <label htmlFor={uid + '-select'}>Choose item</label>
      <select
        id={uid + '-select'}
        name={name}
        required
        className="min-h-11 border rounded-md"
        value={selection?.id ?? ''}
        onChange={(event) =>
          setSelection(current?.items?.find((item) => item.id === event.target.value) ?? null)
        }
      >
        <option value="">Select item</option>
        {selection && !current?.items?.some((item) => item.id === selection.id) && (
          <option value={selection.id}>{selection.name} (selected)</option>
        )}
        {current?.items?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} / {item.kind}
          </option>
        ))}
      </select>
      {!current && <p role="status">Loading item options...</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.items?.length === 0 && <p>No matching items.</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 20)}
        >
          Previous items
        </Button>
        <span>Page {offset / 20 + 1}</span>
        <Button
          type="button"
          variant="outline"
          disabled={!current?.items || current.items.length < 20 || offset >= 10000}
          onClick={() => setOffset(offset + 20)}
        >
          Next items
        </Button>
      </div>
    </fieldset>
  );
}
