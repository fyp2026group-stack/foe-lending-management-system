import Link from 'next/link';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
/** Component reference shell; operational pages use Authenticated. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <nav aria-label="Reference navigation">
        <Link className="text-link" href="/workspace">
          Open laboratory workspace
        </Link>
      </nav>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
export function StateExample({ state }: { state: string }) {
  const messages: Record<string, string> = {
    empty: 'No records in this scope.',
    error: 'Unable to load records.',
    success: 'Operation recorded.',
    denied: 'Record unavailable in the current scope.',
    offline: 'Offline. Mutations are not queued.',
    conflict: 'Record changed. Refresh and review again.',
    unknown: 'Outcome unknown. Check the original event before retrying.',
  };
  return (
    <div className="state-box" role="status">
      <strong>{state}</strong>
      {state === 'Loading' ? (
        <Skeleton className="h-4 w-3/4" />
      ) : (
        <p>{messages[state.toLowerCase()]}</p>
      )}
    </div>
  );
}
