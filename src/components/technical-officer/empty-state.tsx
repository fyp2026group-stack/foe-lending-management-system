import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { officerEmptyCopy } from './empty-model';
export function OfficerEmpty({
  area,
  filtered = false,
  onReset,
  href,
  action,
  onAction,
}: {
  onAction?: () => void;
  area: string;
  filtered?: boolean;
  onReset?: () => void;
  href?: string;
  action?: string;
}) {
  const copy = officerEmptyCopy(area, filtered);
  return (
    <div className="officer-empty" role="status">
      <ClipboardList size={22} aria-hidden="true" />
      <div>
        <h3>{copy.title}</h3>
        <p>{copy.description}</p>
      </div>
      {filtered && onReset ? (
        <Button variant="outline" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      ) : onAction && action ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {action}
        </Button>
      ) : href && action ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>{action}</Link>
        </Button>
      ) : null}
    </div>
  );
}
