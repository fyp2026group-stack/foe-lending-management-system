import { notFound } from 'next/navigation';
import { requirePageRole, allowedBorrowingView } from '@/lib/server/page-access';
import { LendingWorkflow } from '@/components/lending/workflow';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BorrowingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; draftId?: string }>;
}) {
  const { view, draftId } = await searchParams;
  const profile = await requirePageRole();
  if (!allowedBorrowingView(view ?? 'requests', profile.user?.roles ?? [])) notFound();
  if (draftId && (view !== 'new' || !uuid.test(draftId))) notFound();

  return <LendingWorkflow initialView={view} draftId={draftId} />;
}
