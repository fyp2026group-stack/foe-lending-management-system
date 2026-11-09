import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
const flows = ['requests', 'approvals', 'collection', 'returns'] as const;
export function generateStaticParams() { return flows.map(flow => ({ flow })); }
export const dynamicParams = false;
export default async function PreviewPage({ params }: { params: Promise<{ flow: string }> }) {
 const { flow } = await params;
 if (!flows.includes(flow as typeof flows[number])) notFound();
 return <Workspace initialView={flow as typeof flows[number]} />;
}
