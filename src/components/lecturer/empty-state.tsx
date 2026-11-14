import Link from 'next/link';
import { BookOpen, ClipboardCheck, Inbox, PackageOpen, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyKind = 'approvals' | 'requests' | 'drafts' | 'borrowing' | 'activity' | 'policies';

const copy: Record<EmptyKind, { title: string; description: string; icon: typeof Inbox }> = {
  approvals: {
    title: 'No approvals waiting',
    description: 'Requests assigned to your lecturer approval stage will appear here.',
    icon: ClipboardCheck,
  },
  requests: {
    title: 'No borrowing requests yet',
    description:
      'Create a request when you need equipment for teaching, research or laboratory work.',
    icon: Inbox,
  },
  drafts: {
    title: 'No saved drafts',
    description: 'Start a borrowing request and save it before submission to continue it here.',
    icon: Inbox,
  },
  borrowing: {
    title: 'No equipment currently borrowed',
    description:
      'Equipment appears here after an authorized handover is recorded under your identity.',
    icon: PackageOpen,
  },
  activity: {
    title: 'No borrowing activity yet',
    description:
      'Request, approval, handover and return events will appear here when they are recorded.',
    icon: Inbox,
  },
  policies: {
    title: 'No approval policies available',
    description: 'No item approval requirements are visible in your current scope.',
    icon: BookOpen,
  },
};

export function LecturerEmpty({
  kind,
  filtered = false,
  onReset,
  href,
  action,
}: {
  kind: EmptyKind;
  filtered?: boolean;
  onReset?: () => void;
  href?: string;
  action?: string;
}) {
  const item = filtered
    ? {
        title: 'No matching records',
        description:
          'No records match the current filters. Clear them to return to the full authorized list.',
        icon: SearchX,
      }
    : copy[kind];
  const Icon = item.icon;
  return (
    <div className="lecturer-empty" role="status">
      <span className="lecturer-empty-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      {filtered && onReset ? (
        <Button variant="outline" onClick={onReset}>
          Clear filters
        </Button>
      ) : href && action ? (
        <Button asChild variant="outline">
          <Link href={href}>{action}</Link>
        </Button>
      ) : null}
    </div>
  );
}
