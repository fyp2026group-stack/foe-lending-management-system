/** Shared, pure route policy. PostgreSQL session roles remain authoritative. */
export type AppRole = 'STUDENT' | 'LECTURER' | 'TECHNICAL_OFFICER' | 'ADMIN';

export function canOpenBorrowingView(view: string, assigned: readonly AppRole[]): boolean {
  if (view === 'approvals') return assigned.includes('LECTURER') || assigned.includes('ADMIN');
  if (view === 'collection' || view === 'returns') return assigned.includes('TECHNICAL_OFFICER');
  return ['requests', 'new', 'loans', 'history', 'policies'].includes(view);
}
export function canOpenRoute(pathname: string, view: string | null, assigned: readonly AppRole[]): boolean {
  if (!assigned.length) return false;
  if (pathname === '/workspace' || pathname === '/inventory' || pathname === '/equipment') return true;
  if (pathname.startsWith('/admin/')) return assigned.includes('ADMIN');
  if (pathname === '/operations') return assigned.includes('TECHNICAL_OFFICER');
  if (pathname === '/borrowing') return canOpenBorrowingView(view ?? 'requests', assigned);
  return false;
}
