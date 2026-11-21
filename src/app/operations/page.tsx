import { requirePageRole } from '@/lib/server/page-access';
import { officerViews, type OfficerView } from '@/components/technical-officer/model';
import { notFound } from 'next/navigation';
import { OfficerEntry } from '@/components/technical-officer/entry';
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  await requirePageRole(['TECHNICAL_OFFICER']);
  if (view && !officerViews.includes(view as OfficerView)) notFound();
  return <OfficerEntry view={view ?? 'dashboard'} />;
}
