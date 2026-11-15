'use client';
import { Authenticated } from '@/components/identity/session';
import { AdminWorkspace } from '@/components/hod-admin/workspace';
import type { AdminView } from '@/components/hod-admin/model';
export function AdminEntry({ view }: { view: AdminView }) {
  return <Authenticated>{(session) => <AdminWorkspace session={session} view={view} />}</Authenticated>;
}
