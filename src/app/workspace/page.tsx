import { requirePageRole } from '@/lib/server/page-access';
import WorkspaceHome from '@/components/workspace-home';

export default async function WorkspacePage() {
  await requirePageRole();
  return <WorkspaceHome />;
}
