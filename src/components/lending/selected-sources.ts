'use client';
import { useEffect, useState } from 'react';
import { lendingRead, type LendingSource } from './api';

/** Load only the selected equipment, never scan the complete catalogue. */
export function useSelectedSources(itemIds: string[], revision: number): { data?: { items: LendingSource[] }; error?: string } {
  const key = [...new Set(itemIds)].sort().join(',');
  const [state, setState] = useState<{ key: string; data?: { items: LendingSource[] }; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const ids = key ? key.split(',') : [];
    async function load() {
      if (ids.length > 20) throw Error('A request supports up to 20 equipment types.');
      const batches = await Promise.all(ids.map(async itemId => {
        const items: LendingSource[] = [];
        for (let offset = 0; offset < 10000; offset += 100) {
          const page = await lendingRead<{ items: LendingSource[]; total?: number }>('sources?' + new URLSearchParams({ itemId, limit: '100', offset: String(offset) }), controller.signal);
          items.push(...page.items);
          if (page.items.length < 100 || (page.total !== undefined && items.length >= page.total)) return items;
        }
        throw Error('Too many stock locations for selected equipment. Narrow the selection.');
      }));
      if (!controller.signal.aborted) setState({ key, data: { items: batches.flat() } });
    }
    load().catch(error => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Unable to check selected equipment.' }); });
    return () => controller.abort();
  }, [key, revision]);
  return state?.key === key ? state : {};
}
