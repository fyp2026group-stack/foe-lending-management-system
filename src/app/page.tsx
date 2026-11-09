import { Workspace, type View } from '@/components/workspace';
const allowed: View[] = ['inventory','requests','borrowing','approvals','collection','returns','oversight','cohorts','reports','audit','users'];
export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
 const { view } = await searchParams;
 const initialView = allowed.includes(view as View) ? view as View : 'inventory';
 return <Workspace key={initialView} initialView={initialView} />;
}
