/** Keep invalid edits from changing a selection; removal remains possible after stock changes. */
export function editEquipmentSelection<T extends { quantity: number }>(
  current: T[], entry: T, key: (row: T) => string, maximum: number
): T[] {
  if (!Number.isInteger(entry.quantity) || entry.quantity < 0) return current;
  const id = key(entry);
  if (entry.quantity === 0) return current.filter(row => key(row) !== id);
  if (entry.quantity > maximum || maximum < 1) return current;
  const exists = current.some(row => key(row) === id);
  if (!exists && current.length >= 20) return current;
  return exists ? current.map(row => key(row) === id ? entry : row) : [...current, entry];
}
