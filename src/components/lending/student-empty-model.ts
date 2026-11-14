export type StudentEmptyKind =
  | 'equipment'
  | 'requests'
  | 'drafts'
  | 'borrowed'
  | 'history'
  | 'attention'
  | 'activity'
  | 'policies'
  | 'detail'
  | 'decisions'
  | 'comments'
  | 'unavailable'
  | 'equipmentDetail';
const states: Record<
  StudentEmptyKind,
  { title: string; description: string; action: string; href: string }
> = {
  equipment: {
    title: 'No equipment available to request',
    description:
      'Equipment and supplies will appear here when an authorized borrowing source is available.',
    action: 'View borrowing policies',
    href: '/borrowing?view=policies',
  },
  requests: {
    title: 'No borrowing requests yet',
    description:
      'Start a request to select equipment, explain your purpose and choose collection dates.',
    action: 'Start a request',
    href: '/borrowing?view=new',
  },
  drafts: {
    title: 'No saved drafts',
    description: 'Save a borrowing request as a draft to continue it later.',
    action: 'Start a request',
    href: '/borrowing?view=new',
  },
  borrowed: {
    title: 'No equipment currently borrowed',
    description: 'Equipment will appear here after an authorized handover is recorded.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  history: {
    title: 'No borrowing history yet',
    description:
      'Your recorded borrowing activity will appear here as requests and handovers progress.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  attention: {
    title: 'You are up to date',
    description:
      'There are no drafts, collection reservations or corrections requiring your attention.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  activity: {
    title: 'No borrowing activity yet',
    description: 'Recorded request and equipment activity will appear here.',
    action: 'Start a request',
    href: '/borrowing?view=new',
  },
  policies: {
    title: 'No item policies available',
    description: 'Approval requirements will be shown with each available equipment source.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  detail: {
    title: 'Select a request',
    description: 'Choose View on a request to review its items, schedule and approval history.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  comments: {
    title: 'No comments yet',
    description: 'Add a question or a note to this request. Comments remain in its history.',
    action: 'View my requests',
    href: '/borrowing?view=requests',
  },
  unavailable: {
    title: 'Request unavailable',
    description: 'This request is not available in your current scope.',
    action: 'View my requests',
    href: '/borrowing?view=requests',
  },
  equipmentDetail: {
    title: 'Select equipment',
    description:
      'Choose an item to review availability, approval requirements and request quantities.',
    action: 'Browse equipment',
    href: '/inventory',
  },
  decisions: {
    title: 'No approval decisions yet',
    description: 'Recorded decisions and remarks for this item will appear here.',
    action: 'View borrowing policies',
    href: '/borrowing?view=policies',
  },
};
export function studentEmptyContent(kind: StudentEmptyKind, filtered = false) {
  return filtered
    ? {
        title: 'No matching results',
        description: 'Try a broader search or reset the filters to see the available records.',
        action: 'Reset filters',
        href: undefined,
      }
    : states[kind];
}
