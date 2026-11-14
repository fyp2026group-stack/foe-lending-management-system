'use client';
import { useId } from 'react';
import Link from 'next/link';
import {
  Package,
  ClipboardList,
  FileText,
  History,
  CheckCheck,
  Activity,
  BookOpen,
  Search,
  MessageSquare,
} from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { studentEmptyContent, type StudentEmptyKind } from './student-empty-model';
const icons = {
  equipment: Package,
  requests: ClipboardList,
  drafts: FileText,
  borrowed: Package,
  history: History,
  attention: CheckCheck,
  activity: Activity,
  policies: BookOpen,
  detail: ClipboardList,
  decisions: MessageSquare,
  comments: MessageSquare,
  unavailable: ClipboardList,
  equipmentDetail: Package,
};
export function StudentEmptyState({
  kind,
  filtered = false,
  onReset,
  onAction,
  actionLabel,
}: {
  kind: StudentEmptyKind;
  filtered?: boolean;
  onReset?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const id = useId();
  const content = studentEmptyContent(kind, filtered);
  const Icon = filtered ? Search : icons[kind];
  return (
    <CardContent className="student-empty" role="status" aria-labelledby={id}>
      <span className="student-empty-icon">
        <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <h3 id={id}>{content.title}</h3>
      <p>{content.description}</p>
      {filtered ? (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          {content.action}
        </Button>
      ) : onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          {actionLabel ?? content.action}
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={content.href!}>{content.action}</Link>
        </Button>
      )}
    </CardContent>
  );
}
