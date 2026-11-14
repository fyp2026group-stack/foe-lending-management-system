import type { LendingSource, Lecturer } from './api';
import { eligibleLecturers, quantityLimit } from './request-options';

export type BorrowSelection = { itemId: string; quantity: number };

/** The borrower chooses equipment, never a physical store-room stock cell.
 * Resolve actual authorized sources deterministically without weakening
 * the existing source/approval/quantity checks performed by PostgreSQL.
 */
export function resolveBorrowingSources(
  selected: BorrowSelection[],
  sources: LendingSource[],
  lecturers: Lecturer[],
  borrowerId: string
): { lines: (LendingSource & { quantity: number })[]; eligible: Lecturer[] } | null {
  if (!selected.length || selected.length > 20 ||
      new Set(selected.map(row => row.itemId)).size !== selected.length) return null;
  const candidates = selected.map(selection =>
    sources.filter(source =>
      source.itemId === selection.itemId &&
      Number.isInteger(selection.quantity) && selection.quantity >= 1 &&
      selection.quantity <= quantityLimit(source) &&
      source.availableQuantity >= selection.quantity
    ).sort((a,b) =>
      b.availableQuantity - a.availableQuantity ||
      a.labId.localeCompare(b.labId) || a.locationId.localeCompare(b.locationId)
    )
  );
  if (candidates.some(options => options.length === 0)) return null;

  let visited = 0;
  const chosen: (LendingSource & { quantity: number })[] = [];
  function search(index: number):
      { lines: (LendingSource & { quantity: number })[]; eligible: Lecturer[] } | null {
    if (++visited > 20000) return null;
    if (index === selected.length) {
      const needsLecturer = chosen.some(source =>
        source.policy === 'LECTURER' || source.policy === 'BOTH');
      const eligible = eligibleLecturers(lecturers, chosen.map(x => x.labId), borrowerId);
      return !needsLecturer || eligible.length ? { lines: [...chosen], eligible } : null;
    }
    for (const source of candidates[index]) {
      chosen.push({ ...source, quantity: selected[index].quantity });
      const needsLecturer = chosen.some(row =>
        row.policy === 'LECTURER' || row.policy === 'BOTH');
      if (!needsLecturer ||
          eligibleLecturers(lecturers, chosen.map(x => x.labId), borrowerId).length) {
        const result = search(index + 1);
        if (result) return result;
      }
      chosen.pop();
    }
    return null;
  }
  return search(0);
}

export function availablePerEquipment(sources: LendingSource[], itemId: string) {
  const candidates = sources.filter(source => source.itemId === itemId);
  // This is a per-source maximum, NOT a sum across locations. The server
  // currently accepts one exact source per line and cannot reserve a pooled sum.
  return Math.max(0, ...candidates.map(source =>
    Math.min(source.availableQuantity, quantityLimit(source))
  ));
}
