'use client';
import { Authenticated } from '@/components/identity/session';
import { OfficerWorkspace } from './workspace';
export function OfficerEntry({ view }: { view: string }) {
  return (
    <Authenticated>
      {(session) => <OfficerWorkspace key={view} session={session} view={view} />}
    </Authenticated>
  );
}
