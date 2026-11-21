import type { LendingSource } from './api';
export type SourceSelection = { itemId: string; quantity: number; labId?: string; locationId?: string };
export function sameSelectedSource(line: Pick<SourceSelection, 'itemId' | 'labId' | 'locationId'>, source: LendingSource) {
  return line.itemId === source.itemId && line.labId === source.labId && line.locationId === source.locationId;
}
/** Exact source selections never fall back to another laboratory, even after stock disappears. */
export function selectedBrowserSource<T extends LendingSource>(line: SourceSelection, assigned: T[], hydrated: T[], retained: T[], visible: T[]): T | undefined {
  const candidates = [...assigned, ...hydrated, ...retained, ...visible];
  if (line.labId && line.locationId) return candidates.find(row => sameSelectedSource(line, row));
  // Equipment-only requests show only the assigned source or an explicit user choice.
  return [...assigned, ...retained].find(row => row.itemId === line.itemId);
}
