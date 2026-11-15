/** Whitespace/quote independent checks for source evidence.
 * This helper does not replace behavioral and integration tests. */
export function sourceContains(source, snippet) {
  const compact = (value) => value.replace(/\s+/g, '').replaceAll('"', "'");
  return compact(source).includes(compact(snippet));
}
