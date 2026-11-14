'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutGrid,
  Package,
  PackageOpen,
  Undo2,
  Check,
  Boxes,
  ClipboardList,
  FileText,
  Users,
  CalendarDays,
  FlaskConical,
  Menu,
  LogOut,
  ChevronDown,
  Clock3,
  List,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { officerLabels, officerHref, type OfficerView } from '@/components/technical-officer/model';
import { lecturerHref, lecturerLabels, lecturerViews } from '@/components/lecturer/model';
import { adminHref, adminLabels, type AdminView } from '@/components/hod-admin/model';
import { useLendingChoices } from '@/components/lending/shared';
import type { Allocation, Loan } from '@/components/lending/api';
import { isStudent } from '@/components/lending/student-model';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  SidebarInset,
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { api, ApiError, readSession, displayRoles, roleLabels, type Role, type Session } from './api';
import { selectWorkspaceRole } from './workspace-role';

type IconName =
  | 'dashboard'
  | 'handovers'
  | 'returns'
  | 'inspections'
  | 'inventory'
  | 'stock'
  | 'imports'
  | 'requests'
  | 'borrowed'
  | 'activity'
  | 'home'
  | 'borrowing'
  | 'users'
  | 'batches'
  | 'labs'
  | 'menu'
  | 'logout';
const iconComponents = {
  dashboard: LayoutGrid,
  handovers: PackageOpen,
  returns: Undo2,
  inspections: Check,
  inventory: Boxes,
  stock: ClipboardList,
  imports: FileText,
  requests: List,
  borrowed: Package,
  activity: Clock3,
  home: LayoutGrid,
  borrowing: ClipboardList,
  users: Users,
  batches: CalendarDays,
  labs: FlaskConical,
  menu: Menu,
  logout: LogOut,
};
function Icon({ name }: { name: IconName }) {
  const Component = iconComponents[name];
  return <Component size={18} aria-hidden="true" />;
}
export function ErrorNotice({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [message]);
  return (
    <Alert ref={ref} tabIndex={-1} variant="destructive" className="error-notice">
      <AlertTitle>Something needs attention</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Link className="text-link" href="/login">
          Return to sign in
        </Link>
      </AlertDescription>
    </Alert>
  );
}
function OfficerNavigation({
  session,
  currentView,
  pathname,
}: {
  session: Session;
  currentView: string;
  pathname: string;
}) {
  const { setOpenMobile } = useSidebar();
  const revision = Math.max(
    0,
    [
      'dashboard',
      'handovers',
      'returns',
      'inspections',
      'inventory',
      'stock',
      'imports',
      'requests',
      'borrowed',
      'activity',
    ].indexOf(currentView)
  );
  const handovers = useLendingChoices<Allocation>('allocations', revision);
  const returns = useLendingChoices<Loan>('expected', revision);
  const inspections = useLendingChoices<Loan & { inspection?: { status: string } }>(
    'inspections',
    revision
  );
  const counts: Partial<Record<OfficerView, number>> = {
    handovers: handovers.data?.items.filter(
      (row) => row.quantity > row.issued && row.borrowerId !== session.user.id
    ).length,
    returns: returns.data?.items.filter(
      (row) => row.returned < row.quantity && row.borrowerId !== session.user.id
    ).length,
    inspections: inspections.data?.items.filter(
      (row) => row.borrowerId !== session.user.id && row.inspection?.status === 'UNRESOLVED'
    ).length,
  };
  const groups = [
    {
      label: 'Operations',
      views: ['dashboard', 'handovers', 'returns', 'inspections'],
    },
    { label: 'Inventory & stock', views: ['inventory'] },
    { label: 'Personal borrowing', views: ['requests'] },
  ] as const;
  return (
    <nav aria-label="Primary navigation">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.views.map((view) => {
                const href = officerHref(view);
                const active =
                  pathname === href.split('?')[0] &&
                  (href.includes('?') ? href.endsWith('view=' + currentView) : true);
                const count = counts[view];
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={officerLabels[view]}>
                      <Link
                        href={href}
                        onClick={() => setOpenMobile(false)}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon name={view} />
                        <span>{officerLabels[view]}</span>
                        {count !== undefined && (
                          <span className="officer-nav-count" aria-label={`${count} pending`}>
                            {count}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
function LecturerNavigation({ pathname, currentView }: { pathname: string; currentView: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Lecturer workspace navigation">
      <SidebarGroup>
        <SidebarGroupLabel>Lecturer workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {lecturerViews.filter((view) => view !== 'policies').map((view) => {
              const href = lecturerHref(view);
              const active =
                pathname === href.split('?')[0] &&
                (href.includes('?') ? href.endsWith('view=' + currentView) : true);
              const icon: IconName = (
                {
                  dashboard: 'dashboard',
                  equipment: 'inventory',
                  requests: 'requests',
                  borrowed: 'borrowed',
                  approvals: 'inspections',
                  policies: 'labs',
                } as const
              )[view];
              return (
                <SidebarMenuItem key={view}>
                  <SidebarMenuButton asChild isActive={active} tooltip={lecturerLabels[view]}>
                    <Link
                      href={href}
                      onClick={() => setOpenMobile(false)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon name={icon} />
                      <span>{lecturerLabels[view]}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}
function AdminNavigation({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav aria-label="HOD and administrator navigation">
      {[
        { label: 'Department', views: ['overview', 'reports', 'inventory'] as AdminView[] },
        { label: 'Approvals', views: ['approvals'] as AdminView[] },
        { label: 'Administration', views: ['users'] as AdminView[] },
        { label: 'Governance & Personal', views: ['audit', 'borrowing'] as AdminView[] },
      ].map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.views.map((view) => {
                const href = adminHref(view);
                const section = pathname.split('/')[2];
                const active = pathname === href ||
                  (view === 'users' && ['batches', 'laboratories', 'policies'].includes(section)) ||
                  (view === 'inventory' && section === 'adjustments');
                const icon: IconName = (
                  {
                    overview: 'dashboard',
                    reports: 'activity',
                    inventory: 'inventory',
                    approvals: 'inspections',
                    adjustments: 'stock',
                    users: 'users',
                    batches: 'batches',
                    laboratories: 'labs',
                    policies: 'requests',
                    audit: 'activity',
                    borrowing: 'borrowed',
                  } as const
                )[view];
                return (
                  <SidebarMenuItem key={view}>
                    <SidebarMenuButton asChild isActive={active} tooltip={view === 'users' ? 'Administration' : adminLabels[view]}>
                      <Link
                        href={href}
                        onClick={() => setOpenMobile(false)}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon name={icon} />
                        <span>{view === 'users' ? 'Administration' : adminLabels[view]}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
function Navigation({ session }: { session: Session }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const currentView = query.get('view') ?? 'requests';
  const { setOpenMobile } = useSidebar();
  if (session.user.roles.includes('ADMIN')) return <AdminNavigation pathname={pathname} />;
  const officer = session.user.roles.includes('TECHNICAL_OFFICER');
  if (officer)
    return (
      <OfficerNavigation
        session={session}
        currentView={pathname === '/workspace' ? 'dashboard' : currentView}
        pathname={pathname}
      />
    );
  if (session.user.roles.includes('LECTURER'))
    return <LecturerNavigation pathname={pathname} currentView={currentView} />;
  const groups = (
    isStudent(session.user.roles)
      ? [
          {
            label: 'Student workspace',
            items: [
              ['Dashboard', '/workspace', 'home'],
              ['Browse Equipment', '/inventory', 'inventory'],
              ['My Requests', '/borrowing?view=requests', 'borrowing'],
              ['Borrowed Equipment', '/borrowing?view=loans', 'borrowing'],

            ],
          },
        ]
      : [
          {
            label: 'Workspace',
            items: [
              ['Overview', '/workspace', 'home'],
              ['Inventory', '/inventory', 'inventory'],
              ['Borrowed Equipment', '/borrowing', 'borrowing'],
            ],
          },
          ...(session.user.roles.some((r) => ['LECTURER', 'ADMIN'].includes(r))
            ? [
                {
                  label: 'Review',
                  items: [['Approval inbox', '/borrowing?view=approvals', 'borrowing']],
                },
              ]
            : []),
          ...(session.user.roles.includes('TECHNICAL_OFFICER')
            ? [
                {
                  label: 'Equipment held by borrower',
                  items: [
                    ['Handovers', '/borrowing?view=collection', 'inventory'],
                    ['Receive returns', '/borrowing?view=returns', 'inventory'],
                  ],
                },
              ]
            : []),
          ...(session.user.roles.includes('ADMIN')
            ? [
                {
                  label: 'Administration',
                  items: [
                    ['Users & access', '/admin/users', 'users'],
                    ['Academic batches', '/admin/batches', 'batches'],
                    ['Laboratories', '/admin/laboratories', 'labs'],
                    ['Approval policies', '/borrowing?view=policies', 'labs'],
                  ],
                },
              ]
            : []),
        ]
  ) as { label: string; items: [string, string, IconName][] }[];
  return (
    <nav aria-label="Primary navigation">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(([label, href, icon]) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === href.split('?')[0] &&
                      (href.includes('?')
                        ? href.endsWith('view=' + currentView)
                        : href === '/borrowing'
                          ? ['requests', 'new', 'loans', 'history'].includes(currentView)
                          : true)
                    }
                    tooltip={label}
                  >
                    <Link
                      href={href}
                      onClick={() => setOpenMobile(false)}
                      aria-current={
                        pathname === href.split('?')[0] &&
                        (href.includes('?')
                          ? href.endsWith('view=' + currentView)
                          : href === '/borrowing'
                            ? ['requests', 'new', 'loans', 'history'].includes(currentView)
                            : true)
                          ? 'page'
                          : undefined
                      }
                    >
                      <Icon name={icon} />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
function WorkspaceBreadcrumb({
  student = false,
  lecturer = false,
}: {
  student?: boolean;
  lecturer?: boolean;
}) {
  const path = usePathname();
  const query = useSearchParams();
  const area =
    path === '/operations'
      ? (officerLabels[(query.get('view') ?? 'dashboard') as OfficerView] ?? 'Operations')
      : student
        ? path === '/inventory'
          ? 'Browse Equipment'
          : path === '/borrowing'
            ? ({
                requests: 'My Requests',
                new: 'New borrowing request',
                loans: 'Borrowed Equipment',
                history: 'Borrowing History',
                policies: 'Help / Policies',
              }[query.get('view') ?? 'requests'] ?? 'My Requests')
            : 'Dashboard'
        : lecturer
          ? path === '/inventory'
            ? 'Browse Equipment'
            : path === '/borrowing'
              ? ({
                  requests: 'My Requests',
                  new: 'New borrowing request',
                  loans: 'Borrowed Equipment',
                  approvals: 'Approval Inbox',
                  policies: 'Policies & Help',
                }[query.get('view') ?? 'requests'] ?? 'My Requests')
              : 'Dashboard'
          : path.startsWith('/admin')
            ? (adminLabels[(path.split('/')[2] ?? 'overview') as AdminView] ?? 'Administration')
            : path === '/inventory'
              ? 'Inventory'
              : path === '/borrowing'
                ? 'Borrowing'
                : 'Overview';
  const resource = path.startsWith('/admin') ? undefined : path.split('/')[2];
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/workspace">Workspace</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{area}</BreadcrumbPage>
        </BreadcrumbItem>
        {resource && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {resource === 'users'
                  ? 'Users & access'
                  : resource === 'batches'
                    ? 'Academic batches'
                    : 'Laboratories'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
function Brand() {
  return (
    <Link
      href="/workspace"
      className="brand"
      aria-label="Faculty of Engineering laboratory management home"
    >
      <Image
        className="sidebar-logo"
        src="/foe-logo.png"
        width={500}
        height={114}
        alt="Faculty of Engineering, University of Sri Jayewardenepura"
        priority
      />
    </Link>
  );
}

function RoleSwitcher({
  roles,
  active,
  select,
}: {
  roles: string[];
  active: Role;
  select: (role: Role) => void;
}) {
  if (roles.length < 2) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="workspace-role-trigger" aria-label="Switch workspace">
          {roleLabels[active]}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Switch authorized workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.filter((role): role is Role => role in roleLabels).map((role) => (
          <DropdownMenuItem key={role} onSelect={() => select(role)}>
            {roleLabels[role]}{active === role ? ' · Current' : ''}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function Authenticated({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [preferredRole, setPreferredRole] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    api<Session>('/api/auth/me', { signal: controller.signal })
      .then(readSession)
      .then((value) => {
        // This is a presentation preference only. PostgreSQL remains the authority.
        let remembered: string | null = null;
        try { remembered = sessionStorage.getItem('lab-workspace:' + value.user.id); } catch {}
        setPreferredRole(selectWorkspaceRole(value.user.roles, remembered));
        setSession(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Unable to load session.');
      });
    return () => controller.abort();
  }, []);
  async function logout() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/logout', {
        method: 'POST',
        csrfToken: session.csrfToken,
      });
      setSession(null);
      router.replace('/login');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        router.replace('/login');
      } else setError(error instanceof Error ? error.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <main id="main" tabIndex={-1} className="session-loading">
        <div className="loading-mark">FOE</div>
        <h1>Laboratory workspace</h1>
        {error ? (
          <ErrorNotice message={error} />
        ) : (
          <div role="status">
            <p>Loading your workspace...</p>
            <Skeleton className="h-4 w-full my-4" />
            <Skeleton className="h-4 w-2/3 mx-auto" />
          </div>
        )}
      </main>
    );
  const activeRole = selectWorkspaceRole(session.user.roles, preferredRole);
  const viewSession: Session = {
    ...session,
    // Component-level role presentation only; API requests retain the real session
    // and the server always checks the full assigned-role set.
    user: { ...session.user, roles: [activeRole] },
  };
  const chooseRole = (role: Role) => {
    if (!session.user.roles.includes(role)) return;
    setPreferredRole(role);
    try { sessionStorage.setItem('lab-workspace:' + session.user.id, role); } catch {}
    router.replace('/workspace');
  };
  const initials = session.user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  if (
    !viewSession.user.roles.includes('ADMIN') &&
    (isStudent(viewSession.user.roles) ||
      viewSession.user.roles.includes('TECHNICAL_OFFICER') ||
      viewSession.user.roles.includes('LECTURER'))
  )
    return (
      <StudentLayout session={viewSession} initials={initials} busy={busy} logout={logout}
        availableRoles={session.user.roles} onRoleChange={chooseRole}>
        {error && <ErrorNotice message={error} />}
        {children(viewSession)}
      </StudentLayout>
    );
  return (
    <SidebarProvider
      className={
        viewSession.user.roles.includes('ADMIN')
          ? 'workspace admin-shell'
          : isStudent(viewSession.user.roles)
            ? 'workspace student-shell'
            : 'workspace'
      }
      style={
        {
          '--sidebar-width': viewSession.user.roles.includes('ADMIN')
            ? '250px'
            : isStudent(viewSession.user.roles)
              ? '16.5rem'
              : '15.5rem',
        } as React.CSSProperties
      }
    >
      <Sidebar>
        <SidebarHeader>
          <Brand />
          <p className="workspace-label">
            {isStudent(viewSession.user.roles) ? 'Laboratory Equipment Lending' : 'Laboratory services'}
          </p>
        </SidebarHeader>
        <SidebarContent>
          <Navigation session={viewSession} />
        </SidebarContent>
        <SidebarFooter>
          <span className="muted text-xs">Faculty of Engineering</span>
          <span className="muted text-xs">University of Sri Jayewardenepura</span>
        </SidebarFooter>
      </Sidebar>
      <div className="content">
        <div className="institution-bar">
          <span>UNIVERSITY OF SRI JAYEWARDENEPURA</span>
          <span>FACULTY OF ENGINEERING</span>
        </div>
        <header className="topbar">
          <div className="topbar-left">
            <SidebarTrigger />
            <WorkspaceBreadcrumb student={isStudent(viewSession.user.roles)} />
          </div>
          <div className="account-menu">
            <span className="avatar" aria-hidden="true">
              {initials || 'U'}
            </span>
            <span className="account-copy">
              <strong>{session.user.displayName}</strong>
              <small>{roleLabels[activeRole]}</small>
            </span>
            <RoleSwitcher roles={session.user.roles} active={activeRole} select={chooseRole} />
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              onClick={logout}
              aria-label="Sign out"
            >
              <Icon name="logout" />
            </Button>
          </div>
        </header>
        <div className="page-frame">
          {error && <ErrorNotice message={error} />}
          <main id="main" tabIndex={-1}>
            {children(viewSession)}
          </main>
          <footer>Faculty of Engineering / Laboratory inventory and equipment lending</footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

function StudentLayout({
  session,
  initials,
  busy,
  logout,
  children,
  availableRoles,
  onRoleChange,
}: {
  session: Session;
  initials: string;
  busy: boolean;
  logout: () => Promise<void>;
  availableRoles: string[];
  onRoleChange: (role: Role) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        mobileBreakpoint={session.user.roles.includes('TECHNICAL_OFFICER') ? 901 : 768}
        className={
          session.user.roles.includes('TECHNICAL_OFFICER')
            ? 'workspace student-shell officer-shell'
            : session.user.roles.includes('LECTURER')
              ? 'workspace student-shell lecturer-shell'
              : 'workspace student-shell'
        }
        style={
          {
            '--sidebar-width': session.user.roles.includes('TECHNICAL_OFFICER') ? '238px' : '260px',
          } as React.CSSProperties
        }
      >
        <Sidebar
          variant={session.user.roles.includes('TECHNICAL_OFFICER') ? 'sidebar' : 'inset'}
          collapsible={session.user.roles.includes('TECHNICAL_OFFICER') ? 'offcanvas' : 'icon'}
        >
          <SidebarHeader>
            <Brand />
            <p className="workspace-label">Laboratory Equipment Lending</p>
          </SidebarHeader>
          <SidebarContent>
            <Navigation session={session} />
          </SidebarContent>
          <SidebarFooter>
            <FlaskConical size={22} aria-hidden="true" />
            <strong>Laboratory Services</strong>
            <span>Faculty of Engineering</span>
            <small>University of Sri Jayewardenepura</small>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="content">
          <div className="institution-bar">
            <span>UNIVERSITY OF SRI JAYEWARDENEPURA</span>
            <span>FACULTY OF ENGINEERING</span>
          </div>
          <header className="topbar">
            <div className="topbar-left">
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger />
                </TooltipTrigger>
                <TooltipContent>Toggle navigation</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-5" />
              <WorkspaceBreadcrumb
                student={isStudent(session.user.roles)}
                lecturer={session.user.roles.includes('LECTURER')}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="student-account" aria-label="Open account menu">
                  <Avatar>
                    <AvatarFallback>{initials || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="account-copy">
                    <strong>{session.user.displayName}</strong>
                    <small>{displayRoles(session.user.roles)}</small>
                  </span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{session.user.displayName}</DropdownMenuLabel>
                {availableRoles.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Switch workspace</DropdownMenuLabel>
                    {availableRoles.filter((role): role is Role => role in roleLabels).map((role) => (
                      <DropdownMenuItem key={role} onSelect={() => onRoleChange(role)}>
                        {roleLabels[role]}{session.user.roles.includes(role) ? ' · Current' : ''}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={session.user.roles.includes('ADMIN') ? '/admin/policies' : '/borrowing?view=policies'}>Help / Policies</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={busy} onSelect={() => void logout()}>
                  <LogOut size={16} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="page-frame">
            <div id="main" tabIndex={-1}>
              {children}
            </div>
            <footer>Faculty of Engineering / Laboratory inventory and equipment lending</footer>
          </div>
        </SidebarInset>
        <Toaster position="bottom-right" closeButton />
      </SidebarProvider>
    </TooltipProvider>
  );
}
