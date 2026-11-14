export const adminViews = [
  'overview',
  'reports',
  'inventory',
  'approvals',
  'adjustments',
  'users',
  'batches',
  'laboratories',
  'policies',
  'audit',
  'borrowing',
] as const;
export type AdminView = (typeof adminViews)[number];
export const adminLabels: Record<AdminView, string> = {
  overview: 'Department Overview',
  reports: 'Reports & Analytics',
  inventory: 'Inventory Oversight',
  approvals: 'HOD Approval Inbox',
  adjustments: 'Stock Adjustments',
  users: 'Users & Access',
  batches: 'Academic Batches',
  laboratories: 'Laboratories',
  policies: 'Approval Policies',
  audit: 'Audit & History',
  borrowing: 'My Borrowing',
};
export const adminHref = (view: AdminView) =>
  view === 'overview' ? '/workspace' : `/admin/${view}`;
export const adminGroups = [
  { label: 'Department', views: ['overview', 'reports', 'inventory'] },
  { label: 'Workflow & Control', views: ['approvals', 'adjustments'] },
  { label: 'Administration', views: ['users', 'batches', 'laboratories', 'policies'] },
  { label: 'Governance & Personal', views: ['audit', 'borrowing'] },
] as const;
