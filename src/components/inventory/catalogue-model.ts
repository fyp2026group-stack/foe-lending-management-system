import type { Item, Named, Stock } from './api';

export const stockLabels: Record<string, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  BORROWED: 'Borrowed equipment',
  INSPECTION: 'Inspection',
  MAINTENANCE: 'Maintenance',
  CONSUMED: 'Consumed',
  ISSUE: 'Handover',
};
export const stockLabel = (state: string) =>
  stockLabels[state] ?? state.toLowerCase().replaceAll('_', ' ');
export type Balances = {
  available: number;
  reserved?: number;
  borrowed?: number;
  inspection?: number;
  maintenance?: number;
};

// Undefined means not disclosed to this role, never an assumed zero balance.
export function itemBalances(item: Item, cells: Stock[] | undefined): Balances {
  if (!cells)
    return {
      available: item.available ?? 0,
      reserved: item.reserved,
      borrowed: item.borrowed,
      inspection: item.inspection,
      maintenance: item.maintenance,
    };
  const sum = (state: string) =>
    cells
      .filter((cell) => cell.itemId === item.id && cell.state === state)
      .reduce((total, cell) => total + cell.quantity, 0);
  return {
    available: sum('AVAILABLE'),
    reserved: sum('RESERVED'),
    borrowed: sum('BORROWED'),
    inspection: sum('INSPECTION'),
    maintenance: sum('MAINTENANCE'),
  };
}
export type CatalogueSort = 'name' | 'available' | 'reserved' | 'borrowed';
export function catalogueRows(
  items: Item[],
  cells: Stock[] | undefined,
  status: string,
  sort: CatalogueSort,
  descending: boolean
) {
  return items
    .map((item) => ({ item, balance: itemBalances(item, cells) }))
    .filter(({ balance }) => !status || (balance[status as keyof Balances] ?? 0) > 0)
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.item.name.localeCompare(b.item.name, undefined, {
              numeric: true,
              sensitivity: 'base',
            })
          : (a.balance[sort] ?? -1) - (b.balance[sort] ?? -1);
      return (descending ? -order : order) || a.item.id.localeCompare(b.item.id);
    });
}

export function definitionPayload(
  resource: 'items' | 'categories' | 'locations',
  record: Named | Item | undefined,
  fields: Record<string, unknown>,
  deactivate: boolean
) {
  const body: Record<string, unknown> = record ? { expectedVersion: record.version } : {};
  if (record && deactivate) return { ...body, active: false };
  const keys =
    resource === 'items'
      ? ['name', 'categoryId', 'kind', 'uom', 'active', 'specifications']
      : resource === 'locations' && !record
        ? ['name', 'labId']
        : ['name', 'active'];
  for (const key of keys) {
    if (key === 'active' && !record) continue;
    const value = fields[key];
    if (value !== undefined && (!record || value !== (record as Record<string, unknown>)[key]))
      body[key] = value;
  }
  return body;
}

/** A total is known only when every included item discloses that balance. */
export function balanceTotal(items: Item[] | undefined, cells: Stock[] | undefined, key: keyof Balances): number | undefined {
  if (!items) return undefined;
  const values = items.map(item => itemBalances(item, cells)[key]);
  return values.every(value => typeof value === 'number' && Number.isFinite(value))
    ? values.reduce<number>((total, value) => total + value!, 0) : undefined;
}
