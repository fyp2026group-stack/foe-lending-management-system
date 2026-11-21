/** Preserve supplied labels; reject missing values and serialized null placeholders. */
export function displayLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() && !/^(null|undefined)$/i.test(value.trim())
    ? value : fallback;
}
export function personLabel(person: { displayName?: unknown; name?: unknown; email?: unknown }): string {
  return displayLabel(person.displayName, displayLabel(person.name, displayLabel(person.email, 'Name unavailable')));
}
