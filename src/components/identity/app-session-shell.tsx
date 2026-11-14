'use client';
import { usePathname } from 'next/navigation';
import { Authenticated, WorkspaceSessionContext } from './session';
import type { ReactNode } from 'react';

/**
 * Keep one authenticated shell for all operational routes. Next.js Link
 * transitions update the content only; the navigation is not re-mounted.
 */
export function AppSessionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === '/' ||
    pathname === '/login' ||
    pathname === '/design-system' ||
    pathname.startsWith('/preview/');
  if (isPublic) return <>{children}</>;
  return (
    <Authenticated>
      {(session) => (
        <WorkspaceSessionContext.Provider value={session}>
          {children}
        </WorkspaceSessionContext.Provider>
      )}
    </Authenticated>
  );
}
