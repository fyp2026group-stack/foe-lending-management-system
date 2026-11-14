import { LendingWorkflow } from '@/components/lending/workflow';
export default async function BorrowingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <LendingWorkflow initialView={view} />;
}
