/**
 * UUID syntax used by command replay keys and inventory identifiers.
 * This module has no database imports so its validation is independently
 * testable with Node's TypeScript type stripping.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
