import { notFound } from 'next/navigation';
import { Authenticated } from '@/components/identity/session';
import { AdminWorkspace } from '@/components/hod-admin/workspace';
import { adminViews, type AdminView } from '@/components/hod-admin/model';
export default async function AdminPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!adminViews.includes(resource as AdminView)) notFound();
  return (
    <Authenticated>
      {(session) => <AdminWorkspace session={session} view={resource as AdminView} />}
    </Authenticated>
  );
}
