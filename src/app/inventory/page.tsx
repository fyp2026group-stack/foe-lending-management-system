import { requirePageRole } from '@/lib/server/page-access';
import { Inventory } from '@/components/inventory/inventory';
export default async function InventoryPage() {
  await requirePageRole();
  return <Inventory />;
}
