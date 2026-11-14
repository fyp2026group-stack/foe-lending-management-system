import { notFound } from 'next/navigation';
import { requirePageRole } from '@/lib/server/page-access';
import { AdminEntry } from '@/components/hod-admin/entry';
import { adminViews, type AdminView } from '@/components/hod-admin/model';
export default async function AdminPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!adminViews.includes(resource as AdminView)) notFound();
  await requirePageRole(['ADMIN']);
  return <AdminEntry view={resource as AdminView} />;
}
