import { notFound } from 'next/navigation';
import { requirePageRole, allowedBorrowingView } from '@/lib/server/page-access';
import { LendingWorkflow } from '@/components/lending/workflow';
export default async function BorrowingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const profile = await requirePageRole();
  if (!allowedBorrowingView(view ?? 'requests', profile.user?.roles ?? [])) notFound();
  return <LendingWorkflow initialView={view} />;
}
