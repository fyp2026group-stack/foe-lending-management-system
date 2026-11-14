import { notFound, redirect } from 'next/navigation';
export default async function PreviewPage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!['requests', 'approvals', 'collection', 'returns'].includes(flow)) notFound();
  redirect('/borrowing?view=' + flow);
}
