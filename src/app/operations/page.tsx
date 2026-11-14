import { OfficerEntry } from '@/components/technical-officer/entry';
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <OfficerEntry view={view ?? 'dashboard'} />;
}
