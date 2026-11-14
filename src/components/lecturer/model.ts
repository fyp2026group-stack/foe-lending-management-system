export const lecturerViews = [
  'dashboard',
  'equipment',
  'requests',
  'borrowed',
  'approvals',
  'policies',
] as const;
export type LecturerView = (typeof lecturerViews)[number];
export const lecturerLabels: Record<LecturerView, string> = {
  dashboard: 'Dashboard',
  equipment: 'Browse Equipment',
  requests: 'My Requests',
  borrowed: 'Borrowed Equipment',
  approvals: 'Approval Inbox',
  policies: 'Policies & Help',
};
export const lecturerHref = (view: LecturerView) =>
  (
    ({
      dashboard: '/workspace',
      equipment: '/inventory',
      requests: '/borrowing?view=requests',
      borrowed: '/borrowing?view=loans',
      approvals: '/borrowing?view=approvals',
      policies: '/borrowing?view=policies',
    }) as const
  )[view];
