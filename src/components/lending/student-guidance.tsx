'use client';
import Link from 'next/link';
import { Package, Plus, FileText, Layers, ArrowRight, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
const reminders = [
  'Borrow only for authorized academic work.',
  'Collect items only after confirmation of readiness.',
  'Return equipment by the expected return date.',
  'Report damage or equipment issues to laboratory staff.',
];
const steps = [
  'Browse equipment and select one or more items.',
  'Complete the request with your academic purpose and relevant dates.',
  'Select an eligible lecturer when required by the item policy.',
  'Wait for lecturer and/or HOD approval, where applicable.',
  'Collect the approved equipment from an authorized technical officer after readiness is confirmed.',
  'Return equipment by the agreed date. Returned items require inspection clearance before reuse.',
];
export function StudentGuidance() {
  return (
    <div className="student-page student-guidance">
      <PageHeader
        eyebrow="Student workspace"
        title="Help & borrowing guidance"
        description="Understand the equipment request and return process."
      />
      <Card className="student-panel">
        <CardHeader>
          <CardTitle>
            <h2>How borrowing works</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="student-guidance-steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="student-guidance-note">
            Item approval requirements appear while browsing equipment and completing a request.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
export function StudentReminders() {
  return (
    <Card className="student-card student-panel">
      <CardHeader>
        <CardTitle>
          <h2>Policies and reminders</h2>
        </CardTitle>
        <CardDescription>Key lending guidance.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="student-reminder-list">
          {reminders.map((reminder) => (
            <li key={reminder}>{reminder}</li>
          ))}
        </ul>
        <Button asChild variant="outline" className="student-guidance-link">
          <Link href="/borrowing?view=policies">
            <BookOpen size={16} aria-hidden="true" />
            View borrowing guidance
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
const actions = [
  {
    title: 'Browse equipment',
    description: 'Find available items for academic work',
    href: '/inventory',
    Icon: Package,
  },
  {
    title: 'Start request',
    description: 'Create a new borrowing request',
    href: '/borrowing?view=new',
    Icon: Plus,
  },
  {
    title: 'My requests',
    description: 'Track approval and collection',
    href: '/borrowing?view=requests',
    Icon: FileText,
  },
  {
    title: 'Borrowed items',
    description: 'See equipment you currently hold',
    href: '/borrowing?view=loans',
    Icon: Layers,
  },
];
export function StudentQuickActions() {
  return (
    <Card className="student-card student-panel">
      <CardHeader>
        <CardTitle>
          <h2>Quick actions</h2>
        </CardTitle>
        <CardDescription>Common student tasks.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="student-quick student-action-tiles">
          {actions.map(({ title, description, href, Icon }) => (
            <Link href={href} key={href} className="student-action-tile">
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              <strong>{title}</strong>
              <small title={description}>{description}</small>
              <ArrowRight className="student-tile-arrow" size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
