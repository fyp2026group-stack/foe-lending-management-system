/* DESIGN REFERENCE ONLY — sample records and local interactions; no backend or credentials. */
const paths = {
  home: 'M3 9.5 12 2l9 7.5V20h-6v-6H9v6H3z',
  chart: 'M3 3v18h18 M7 17v-5 M12 17V8 M17 17V5',
  package: 'M12 2 3 7v10l9 5 9-5V7L12 2z M3 7l9 5 9-5 M12 12v10',
  check: 'M20 6 9 17l-5-5',
  clipboard: 'M9 3h6v3H9z M8 5H5v16h14V5h-3 M8 10h8 M8 14h8 M8 18h6',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
  calendar: 'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18',
  building: 'M3 21V5l9-3 9 3v16 M9 21v-5h6v5 M7 8h2 M15 8h2 M7 12h2 M15 12h2',
  shield: 'M12 2l9 4v6c0 5-3 8-9 10-6-2-9-5-9-10V6z M8 12l3 3 5-6',
  history: 'M3 12a9 9 0 1 0 3-6 M3 4v5h5 M12 7v5l4 2',
  book: 'M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 0-2 2V3z M4 17h16',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  plus: 'M12 5v14 M5 12h14',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 18v3h16v-3',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  x: 'M18 6 6 18 M6 6l12 12',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  alert: 'M12 3 2 21h20L12 3z M12 9v4 M12 17h.01',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  edit: 'M12 20h9 M16 4l4 4-11 11-4 1 1-4L17 5',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',
  file: 'M5 3h10l5 5v13H5z M15 3v5h5 M8 12h9 M8 16h9',
  layers: 'M12 2 2 8l10 6 10-6-10-6z M2 12l10 6 10-6 M2 16l10 6 10-6',
  checkcircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M7 12l3 3 6-6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 9a7 7 0 0 1 12-2l2 5 M18 15a7 7 0 0 1-12 2l-2-5',
  logout: 'M9 3H4v18h5 M14 7l5 5-5 5 M19 12H9',
  spark: 'M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2z',
  clipboardCheck: 'M8 3h8v3H8z M6 5H4v16h16V5h-2 M8 13l3 3 5-5',
  printer: 'M6 3h12v5H6z M6 16H4v-6h16v6h-2 M6 14h12v8H6z',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z M12 12a2.5 2.5 0 1 0 0-.01',
  tag: 'M2 12V4h8l12 12-8 8L2 12z M6 8h.01',
  sliders: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M3 22v-3a9 9 0 0 1 18 0v3',
};
const icon = (name, size = 17) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const badge = (name, type = '') => `<span class="chip ${type}">${esc(name)}</span>`;
const button = (name, action = 'noop()', variant = '', i = '') =>
  `<button class="btn ${variant}" type="button" onclick="${action}">${i ? icon(i) : ''}${name}</button>`;
const surface = (title, body, extra = '', sub = '') =>
  `<section class="surface"><div class="surfaceHeader"><div><div class="surfaceTitle">${title}</div>${sub ? `<div class="surfaceSub">${sub}</div>` : ''}</div>${extra}</div>${body}</section>`;
const head = (eyebrow, title, subtitle, actions = '') =>
  `<div class="pageHead"><div><div class="eyebrow">${eyebrow}</div><h1 class="h1">${title}</h1><p class="subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`;
const stat = (label, value, foot, i, more = '') =>
  `<div class="surface stat"><div class="statLabel">${label}</div><div class="statIcon">${icon(i)}</div><div class="statValue ${more}">${value}</div><div class="statFoot">${foot}</div></div>`;
const field = (name, id, choices, sty = '') =>
  `<div class="field ${sty}"><label for="${id}">${name}</label>${Array.isArray(choices) ? `<select id="${id}">${choices.map((c) => `<option value="${esc(typeof c === 'string' ? c : c[0])}">${esc(typeof c === 'string' ? c : c[1])}</option>`).join('')}</select>` : `<input id="${id}" type="${choices === 'date' ? 'date' : 'text'}" placeholder="${esc(choices)}">`}</div>`;
const table = (heads, rows, footer = '') =>
  `<div class="tableBox"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>${footer ? `<div class="tableFoot">${footer}</div>` : ''}`;
const navGroups = [
  {
    label: 'DEPARTMENT',
    items: [
      ['dashboard', 'Overview', 'home'],
      ['reports', 'Reports & Analytics', 'chart'],
      ['inventory', 'Inventory Oversight', 'package'],
    ],
  },
  {
    label: 'WORKFLOW & CONTROL',
    items: [
      ['approvals', 'HOD Approval Inbox', 'clipboard', 9],
      ['adjustments', 'Stock Adjustments', 'clipboardCheck', 3],
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      ['users', 'Users & Access', 'users'],
      ['batches', 'Academic Batches', 'calendar'],
      ['labs', 'Laboratories', 'building'],
      ['policies', 'Approval Policies', 'sliders'],
    ],
  },
  {
    label: 'GOVERNANCE & PERSONAL',
    items: [
      ['audit', 'Audit & History', 'history'],
      ['personal', 'My Borrowing', 'book'],
    ],
  },
];
const labs = [
  {
    id: 1,
    name: 'Electronics Laboratory',
    code: 'EL-01',
    officers: 2,
    borrowed: 17,
    available: 56,
    status: 'Active',
  },
  {
    id: 2,
    name: 'Embedded Systems Laboratory',
    code: 'ES-02',
    officers: 2,
    borrowed: 11,
    available: 39,
    status: 'Active',
  },
  {
    id: 3,
    name: 'Robotics Laboratory',
    code: 'RB-03',
    officers: 1,
    borrowed: 9,
    available: 28,
    status: 'Active',
  },
  {
    id: 4,
    name: 'Instrumentation Laboratory',
    code: 'IN-04',
    officers: 1,
    borrowed: 5,
    available: 23,
    status: 'Active',
  },
];
const inventory = [
  {
    id: 1,
    name: 'Digital Multimeter',
    category: 'Measurement',
    lab: 'Electronics Laboratory',
    type: 'Returnable',
    avail: 21,
    res: 3,
    borrowed: 8,
    inspect: 2,
    maint: 1,
    policy: 'Lecturer',
    desc: 'Handheld instruments for electrical measurement classes.',
  },
  {
    id: 2,
    name: 'Oscilloscope',
    category: 'Signal Analysis',
    lab: 'Electronics Laboratory',
    type: 'Returnable',
    avail: 12,
    res: 2,
    borrowed: 6,
    inspect: 2,
    maint: 1,
    policy: 'Both',
    desc: 'Bench instruments for digital and analog waveform inspection.',
  },
  {
    id: 3,
    name: 'Arduino Uno',
    category: 'Microcontrollers',
    lab: 'Embedded Systems Laboratory',
    type: 'Returnable',
    avail: 29,
    res: 4,
    borrowed: 7,
    inspect: 1,
    maint: 0,
    policy: 'Lecturer',
    desc: 'Development boards for embedded programming practicals.',
  },
  {
    id: 4,
    name: 'Sensor Development Kit',
    category: 'Robotics',
    lab: 'Robotics Laboratory',
    type: 'Returnable',
    avail: 18,
    res: 3,
    borrowed: 9,
    inspect: 1,
    maint: 2,
    policy: 'Both',
    desc: 'Reusable sensor kits for project-based learning.',
  },
  {
    id: 5,
    name: 'Function Generator',
    category: 'Signal Analysis',
    lab: 'Instrumentation Laboratory',
    type: 'Returnable',
    avail: 23,
    res: 1,
    borrowed: 5,
    inspect: 1,
    maint: 0,
    policy: 'HOD',
    desc: 'Signal generators for instrumentation and control.',
  },
  {
    id: 6,
    name: 'DC Power Supply',
    category: 'Power & Supply',
    lab: 'Electronics Laboratory',
    type: 'Returnable',
    avail: 25,
    res: 3,
    borrowed: 7,
    inspect: 2,
    maint: 2,
    policy: 'None',
    desc: 'Variable DC supplies for laboratory benches.',
  },
  {
    id: 7,
    name: 'Resistor Kit',
    category: 'Components',
    lab: 'Embedded Systems Laboratory',
    type: 'Consumable',
    avail: 580,
    res: 0,
    borrowed: 0,
    inspect: 0,
    maint: 0,
    policy: 'None',
    desc: 'Quantity-tracked resistor kits and components.',
  },
  {
    id: 8,
    name: 'Logic Analyzer',
    category: 'Digital Systems',
    lab: 'Embedded Systems Laboratory',
    type: 'Returnable',
    avail: 18,
    res: 1,
    borrowed: 0,
    inspect: 2,
    maint: 0,
    policy: 'Unconfigured',
    desc: 'Digital sampling instruments; policy setup required.',
  },
];
let requests = [
  {
    id: 'REQ-2026-0148',
    borrower: '23ENG071',
    name: 'N. Perera',
    batch: '2023',
    lab: 'Electronics Laboratory',
    items: 'Oscilloscope ×1, Multimeter ×1',
    count: 2,
    stage: 'HOD',
    date: '2026-11-11',
    purpose: 'Instrumentation project measurement and calibration',
    policy: 'Both',
    status: 'Awaiting HOD approval',
    lecturer: 'Dr. R. Silva',
    self: false,
  },
  {
    id: 'REQ-2026-0147',
    borrower: '22ENG015',
    name: 'K. Jayasinghe',
    batch: '2022',
    lab: 'Robotics Laboratory',
    items: 'Sensor Development Kit ×1',
    count: 1,
    stage: 'HOD',
    date: '2026-11-11',
    purpose: 'Robot navigation prototype demonstration',
    policy: 'Both',
    status: 'Awaiting HOD approval',
    lecturer: 'Dr. M. Fernando',
    self: false,
  },
  {
    id: 'REQ-2026-0143',
    borrower: '24ENG042',
    name: 'A. Fernando',
    batch: '2024',
    lab: 'Instrumentation Laboratory',
    items: 'Function Generator ×1',
    count: 1,
    stage: 'HOD',
    date: '2026-11-10',
    purpose: 'Approved lab activity',
    policy: 'HOD',
    status: 'Awaiting HOD approval',
    lecturer: 'Not applicable',
    self: false,
  },
  {
    id: 'REQ-2026-0141',
    borrower: 'staff-admin',
    name: 'Synthetic Administrator',
    batch: 'Staff',
    lab: 'Electronics Laboratory',
    items: 'Multimeter ×1',
    count: 1,
    stage: 'HOD',
    date: '2026-11-10',
    purpose: 'Technical workshop',
    policy: 'HOD',
    status: 'Awaiting HOD approval',
    lecturer: 'Not applicable',
    self: true,
  },
  {
    id: 'REQ-2026-0138',
    borrower: '23ENG099',
    name: 'S. Wickramasinghe',
    batch: '2023',
    lab: 'Embedded Systems Laboratory',
    items: 'Arduino Uno ×2',
    count: 1,
    stage: 'HOD',
    date: '2026-11-09',
    purpose: 'Microcontroller practical assessments',
    policy: 'Both',
    status: 'Awaiting HOD approval',
    lecturer: 'Dr. R. Silva',
    self: false,
  },
];
const students = [
  { name: 'N. Perera', reg: '23ENG071', batch: '2023' },
  { name: 'A. Fernando', reg: '24ENG042', batch: '2024' },
  { name: 'S. Wickramasinghe', reg: '23ENG099', batch: '2023' },
];
let users = [
  {
    id: 1,
    name: 'Synthetic Administrator',
    email: 'admin@example.invalid',
    roles: ['HOD/Admin'],
    batch: '—',
    labs: 'Department-wide',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Dr. R. Silva',
    email: 'lecturer.silva@example.invalid',
    roles: ['Lecturer'],
    batch: '—',
    labs: 'Electronics Laboratory',
    status: 'Active',
  },
  {
    id: 3,
    name: 'Dr. M. Fernando',
    email: 'lecturer.fernando@example.invalid',
    roles: ['Lecturer'],
    batch: '—',
    labs: 'Robotics Laboratory',
    status: 'Active',
  },
  {
    id: 4,
    name: 'Technical Officer A',
    email: 'officer.a@example.invalid',
    roles: ['Technical Officer'],
    batch: '—',
    labs: 'Electronics Laboratory',
    status: 'Active',
  },
  {
    id: 5,
    name: 'Technical Officer B',
    email: 'officer.b@example.invalid',
    roles: ['Technical Officer', 'Lecturer'],
    batch: '—',
    labs: 'Embedded Systems Laboratory',
    status: 'Active',
  },
  {
    id: 6,
    name: 'N. Perera',
    email: 'student071@example.invalid',
    roles: ['Student'],
    batch: '2023',
    registration: '23ENG071',
    labs: '—',
    status: 'Active',
  },
  {
    id: 7,
    name: 'A. Fernando',
    email: 'student042@example.invalid',
    roles: ['Student'],
    batch: '2024',
    registration: '24ENG042',
    labs: '—',
    status: 'Active',
  },
  {
    id: 8,
    name: 'S. Wickramasinghe',
    email: 'student099@example.invalid',
    roles: ['Student'],
    batch: '2023, 2024',
    registration: '23ENG099',
    labs: '—',
    status: 'Active',
  },
  {
    id: 9,
    name: 'Disabled Example Account',
    email: 'disabled@example.invalid',
    roles: ['Student'],
    batch: '2022',
    registration: '22ENG000',
    labs: '—',
    status: 'Disabled',
  },
];
let batches = [
  { id: 1, name: '2022', code: 'ENG-2022', students: 112, status: 'Active' },
  { id: 2, name: '2023', code: 'ENG-2023', students: 119, status: 'Active' },
  { id: 3, name: '2024', code: 'ENG-2024', students: 124, status: 'Active' },
  { id: 4, name: '2025', code: 'ENG-2025', students: 126, status: 'Active' },
];
let adjustments = [
  {
    id: 'ADJ-0261',
    item: 'Digital Multimeter',
    lab: 'Electronics Laboratory',
    change: '−1 unit',
    reason: 'Physical count discrepancy',
    proposer: 'Technical Officer A',
    submitted: '11 Nov 2026',
    status: 'Pending',
    self: false,
  },
  {
    id: 'ADJ-0259',
    item: 'Sensor Development Kit',
    lab: 'Robotics Laboratory',
    change: '+2 units',
    reason: 'Correction after verified count',
    proposer: 'Technical Officer B',
    submitted: '10 Nov 2026',
    status: 'Pending',
    self: false,
  },
  {
    id: 'ADJ-0252',
    item: 'Arduino Uno',
    lab: 'Embedded Systems Laboratory',
    change: '−1 unit',
    reason: 'Inventory count reconciliation',
    proposer: 'Synthetic Administrator',
    submitted: '09 Nov 2026',
    status: 'Pending',
    self: true,
  },
  {
    id: 'ADJ-0240',
    item: 'Function Generator',
    lab: 'Instrumentation Laboratory',
    change: '+1 unit',
    reason: 'Previously counted stock found',
    proposer: 'Technical Officer A',
    submitted: '07 Nov 2026',
    status: 'Approved',
    self: false,
  },
];
const audit = [
  {
    time: '11 Nov · 14:48',
    title: 'Stock receipt recorded',
    detail: 'Digital Multimeter · Electronics Laboratory · by Technical Officer A',
    type: 'stock',
  },
  {
    time: '11 Nov · 13:22',
    title: 'Lecturer approval completed',
    detail: 'REQ-2026-0148 · Lecturer stage closed · HOD stage pending',
    type: 'approvals',
  },
  {
    time: '11 Nov · 11:11',
    title: 'Equipment returned',
    detail: 'REQ-2026-0135 · Return receipt recorded · awaiting inspection',
    type: 'stock',
  },
  {
    time: '11 Nov · 10:39',
    title: 'Account role changed',
    detail: 'Technical Officer B · Staff assignment updated by authorized administrator',
    type: 'identity',
  },
  {
    time: '11 Nov · 09:52',
    title: 'Approval policy updated',
    detail: 'Function Generator · HOD approval · changed by authorized administrator',
    type: 'identity',
  },
  {
    time: '10 Nov · 16:42',
    title: 'Equipment handed over',
    detail: 'REQ-2026-0129 · Robotics Laboratory · by Technical Officer B',
    type: 'stock',
  },
  {
    time: '10 Nov · 12:18',
    title: 'Authentication event recorded',
    detail: 'Session revocation · identity/security audit (not lending activity)',
    type: 'security',
  },
];
let state = {
  page: 'dashboard',
  reportsTab: 'borrowed',
  auditTab: 'operations',
  searches: {},
  lab: 'All laboratories',
  batch: 'All batches',
  reportLab: 'All laboratories',
  reportBatch: 'All batches',
  reportStatus: 'All statuses',
  reportDateStart: '2026-11-01',
  reportDateEnd: '2026-11-30',
  advancedReports: false,
  reportCategory: 'All categories',
  reportBorrower: '',
  reportLecturer: 'All lecturers',
  reportOfficer: 'All issuing officers',
  selectedApproval: 'REQ-2026-0148',
  modalAction: null,
};
function pillPolicy(p) {
  return p === 'Unconfigured'
    ? badge('Unconfigured', 'red')
    : p === 'Both'
      ? badge('Lecturer → HOD', 'amber')
      : p === 'Lecturer'
        ? badge('Lecturer', 'blue')
        : p === 'HOD'
          ? badge('HOD', 'maroon')
          : badge('No academic approval');
}
function approveStatus(s) {
  return s === 'Active' || s === 'Approved'
    ? badge(s, 'green')
    : s === 'Pending' || s.includes('Awaiting')
      ? badge(s, 'amber')
      : s === 'Disabled' || s === 'Rejected'
        ? badge(s, 'red')
        : badge(s);
}
function getFilter(id) {
  return document.getElementById(id)?.value || '';
}
function navTo(id) {
  state.page = id;
  state.searches = {};
  closeDrawer();
  hideModal();
  document.querySelector('.sidebar').classList.remove('open');
  render();
  window.scrollTo(0, 0);
}
function toast(msg) {
  const e = document.getElementById('toast');
  e.textContent = msg;
  e.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => e.classList.remove('show'), 3000);
}
function noop() {
  toast('Reference interaction only. Production will use authenticated server APIs.');
}
function renderNav() {
  document.getElementById('nav').innerHTML = navGroups
    .map(
      (g) =>
        `<section class="navGroup"><div class="navTitle">${g.label}</div>${g.items.map(([id, label, i, c]) => `<button type="button" class="navBtn ${state.page === id ? 'active' : ''}" onclick="navTo('${id}')">${icon(i)}<span>${label}</span>${c ? `<span class="navCount">${c}</span>` : ''}</button>`).join('')}</section>`
    )
    .join('');
}
function render() {
  renderNav();
  let screens = {
    dashboard: dashboardPage,
    reports: reportsPage,
    inventory: inventoryPage,
    approvals: approvalsPage,
    adjustments: adjustmentsPage,
    users: usersPage,
    batches: batchesPage,
    labs: labsPage,
    policies: policiesPage,
    audit: auditPage,
    personal: personalPage,
  };
  document.getElementById('pageRoot').innerHTML = screens[state.page]();
  let title = navGroups.flatMap((g) => g.items).find((n) => n[0] === state.page)?.[1] || 'Overview';
  document.getElementById('crumb').textContent = title;
  document.title = `${title} · Faculty Laboratory Administration`;
}
function scopeSelector() {
  return `<select id="scopeLab" onchange="state.lab=this.value;render()"><option>All laboratories</option>${labs.map((l) => `<option ${state.lab === l.name ? 'selected' : ''}>${l.name}</option>`).join('')}</select>`;
}
function dashboardPage() {
  const labTitle =
    state.lab === 'All laboratories' ? 'Across authorized department laboratories' : state.lab;
  const scopeCounts = {
    'All laboratories': {
      borrowed: 42,
      overdue: 7,
      pending: 9,
      inspection: 11,
      available: 146,
      reserved: 17,
      maintenance: 6,
    },
    'Electronics Laboratory': {
      borrowed: 17,
      overdue: 3,
      pending: 4,
      inspection: 5,
      available: 56,
      reserved: 6,
      maintenance: 2,
    },
    'Embedded Systems Laboratory': {
      borrowed: 11,
      overdue: 2,
      pending: 2,
      inspection: 3,
      available: 39,
      reserved: 4,
      maintenance: 1,
    },
    'Robotics Laboratory': {
      borrowed: 9,
      overdue: 1,
      pending: 2,
      inspection: 2,
      available: 28,
      reserved: 4,
      maintenance: 2,
    },
    'Instrumentation Laboratory': {
      borrowed: 5,
      overdue: 1,
      pending: 1,
      inspection: 1,
      available: 23,
      reserved: 3,
      maintenance: 1,
    },
  };
  const c = scopeCounts[state.lab] || scopeCounts['All laboratories'];
  const total = c.borrowed + c.available + c.reserved + c.inspection + c.maintenance;
  let workqueue = `<div class="queueItem"><div><strong>${c.pending} HOD decisions require review</strong><small>5 assigned records include item-level decisions and mixed approval paths</small></div>${button('Review', 'navTo("approvals")', 'small', 'arrow')}</div><div class="queueItem"><div><strong>3 stock adjustment proposals</strong><small>Pending independent approval; no proposer can approve their own adjustment</small></div>${button('Review', 'navTo("adjustments")', 'small', 'arrow')}</div><div class="queueItem"><div><strong>${c.inspection} returnable units awaiting inspection</strong><small>Follow up with assigned laboratory officers; items remain unavailable</small></div>${button('View stock', 'navTo("inventory")', 'small', 'arrow')}</div><div class="queueItem"><div><strong>${c.overdue} overdue borrowing records</strong><small>Review borrowers, academic batches and due dates</small></div>${button('Open report', 'navTo("reports")', 'small', 'arrow')}</div>`;
  return (
    head(
      'Department operations',
      'Department overview',
      'A clear view of equipment lending, stock position and decisions requiring HOD attention.',
      `<label class="field"><span style="font-size:10px;color:#8996a7">Laboratory scope</span>${scopeSelector()}</label>${button('Open reports', 'navTo("reports")', 'primary', 'chart')}`
    ) +
    `<div class="stats">${stat('Currently borrowed units', String(c.borrowed), 'Returnable equipment currently issued', 'package')}${stat('Overdue borrowing records', String(c.overdue), 'Past expected return date', 'clock', 'statDanger')}${stat('Pending HOD decisions', String(c.pending), 'Only records assigned to this account', 'clipboard')}${stat('Awaiting inspection', String(c.inspection), 'Returned units not yet available', 'checkcircle')}</div>` +
    `<div class="columns"><div class="stack">${surface('Work requiring attention', workqueue, button('See approval inbox', 'navTo("approvals")', 'link', 'arrow'), 'Prioritized tasks and independent approval obligations')}${surface(
      'Borrowing by academic batch',
      `<div class="surfaceBody"><div class="batchRows">${[
        ['2022', 64],
        ['2023', 89],
        ['2024', 71],
        ['2025', 49],
      ]
        .map(
          ([b, n]) =>
            `<div class="batch"><span class="lbl">Batch ${b}</span><span class="bar"><span style="width:${n}%"></span></span><span class="val">${n}</span></div>`
        )
        .join(
          ''
        )}</div><div class="help">Illustrative number of borrowing transactions in the report period; select Reports for actual cohort filtering.</div></div>`,
      button('Explore cohorts', 'navTo("reports")', 'link', 'arrow'),
      'Illustrative comparison · defined report period'
    )}</div>
<div class="stack">${surface('Returnable equipment position', `<div class="surfaceBody"><div class="subhead">Current state across returnable units</div><div class="stockbar"><span style="width:${((100 * c.available) / total).toFixed(2)}%"></span><span style="width:${((100 * c.borrowed) / total).toFixed(2)}%"></span><span style="width:${((100 * c.reserved) / total).toFixed(2)}%"></span><span style="width:${((100 * c.inspection) / total).toFixed(2)}%"></span><span style="width:${((100 * c.maintenance) / total).toFixed(2)}%"></span></div><div class="miniGrid"><div class="miniItem"><strong>${c.available}</strong><span>Available</span></div><div class="miniItem"><strong>${c.borrowed}</strong><span>Borrowed</span></div><div class="miniItem"><strong>${c.reserved}</strong><span>Reserved</span></div><div class="miniItem"><strong>${c.inspection}</strong><span>Inspection</span></div><div class="miniItem"><strong>${c.maintenance}</strong><span>Maintenance</span></div></div><p class="help">${total} returnable units. Consumable quantities are tracked separately and never mixed into this total.</p></div>`, button('Inventory details', 'navTo("inventory")', 'link', 'arrow'), 'Scope: ' + esc(labTitle))}${surface(
      'Recent operational activity',
      `<div>${audit
        .filter((a) => ['stock', 'approvals'].includes(a.type))
        .slice(0, 4)
        .map(
          (a) =>
            `<div class="auditRow"><span class="auditDot"></span><div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div><time>${esc(a.time)}</time></div>`
        )
        .join('')}</div>`,
      button('View history', 'navTo("audit")', 'link', 'arrow'),
      'Borrowing and stock events, not sign-in activity'
    )}</div></div>`
  );
}
function reportsPage() {
  const tabs = [
    ['borrowed', 'Borrowing'],
    ['overdue', 'Overdue'],
    ['inventory', 'Inventory position'],
    ['approvals', 'Approvals'],
  ];
  return (
    head(
      'Department intelligence',
      'Reports & analytics',
      'Analyze equipment use by academic batch, laboratory, category, borrower, lecturer, issuing officer and date. Export only authorized records.',
      `${button('Export filtered CSV', 'exportDemoCsv()', '', 'download')}${button('Export XLSX', 'toast("XLSX requires a production server export; no fake XLSX is generated.")', 'primary', 'download')}`
    ) +
    `<section class="surface"><div class="tabbar">${tabs.map(([id, title]) => `<button class="tab ${state.reportsTab === id ? 'active' : ''}" onclick="state.reportsTab='${id}';render()">${title}</button>`).join('')}</div><div class="filterbar">${field('Academic batch', 'rBatch', ['All batches', '2022', '2023', '2024', '2025'])}${field('Laboratory', 'rLab', ['All laboratories', ...labs.map((l) => l.name)])}${field('Status', 'rStatus', ['All statuses', 'Borrowed', 'Overdue', 'Returned', 'Pending', 'Approved'])}${field('From', 'rStart', 'date')}${field('To', 'rEnd', 'date')}${button('More filters', 'state.advancedReports=!state.advancedReports;render()', '', 'sliders')}${button('Apply filters', 'applyReport()', 'primary', 'filter')}</div>${state.advancedReports ? `<div class="extraFilters">${field('Equipment category', 'rCategory', ['All categories', ...new Set(inventory.map((i) => i.category))])}${field('Borrower', 'rBorrower', 'Search borrower...')}${field('Lecturer', 'rLecturer', ['All lecturers', 'Dr. R. Silva', 'Dr. M. Fernando'])}${field('Issuing officer', 'rOfficer', ['All issuing officers', 'Technical Officer A', 'Technical Officer B'])}</div>` : ''}<div id="reportView">${reportBody()}</div></section>`
  );
}
function reportBody() {
  const type = state.reportsTab;
  const header =
    type === 'borrowed'
      ? 'Borrowing activity'
      : type === 'overdue'
        ? 'Overdue equipment'
        : type === 'inventory'
          ? 'Inventory position'
          : 'Approval performance';
  const rows = {
    borrowed: [
      [
        '2023',
        'Electronics Laboratory',
        'Digital Multimeter',
        'N. Perera',
        'Dr. R. Silva',
        'Technical Officer A',
        'Borrowed',
      ],
      [
        '2024',
        'Embedded Systems Laboratory',
        'Arduino Uno',
        'A. Fernando',
        'Dr. R. Silva',
        'Technical Officer B',
        'Returned',
      ],
      [
        '2022',
        'Robotics Laboratory',
        'Sensor Development Kit',
        'K. Jayasinghe',
        'Dr. M. Fernando',
        'Technical Officer B',
        'Borrowed',
      ],
      [
        '2023',
        'Electronics Laboratory',
        'Oscilloscope',
        'S. Wickramasinghe',
        'Dr. R. Silva',
        'Technical Officer A',
        'Borrowed',
      ],
    ],
    overdue: [
      [
        '2022',
        'Electronics Laboratory',
        'Oscilloscope',
        'K. Jayasinghe',
        '2026-11-07',
        '4 days',
        'Overdue',
      ],
      [
        '2023',
        'Robotics Laboratory',
        'Sensor Development Kit',
        'N. Perera',
        '2026-11-09',
        '2 days',
        'Overdue',
      ],
      [
        '2024',
        'Embedded Systems Laboratory',
        'Arduino Uno',
        'A. Fernando',
        '2026-11-10',
        '1 day',
        'Overdue',
      ],
    ],
    inventory: [
      ['Electronics Laboratory', 'Digital Multimeter', 'Returnable', '21', '3', '8', '2'],
      ['Electronics Laboratory', 'Oscilloscope', 'Returnable', '12', '2', '6', '2'],
      ['Embedded Systems Laboratory', 'Arduino Uno', 'Returnable', '29', '4', '7', '1'],
      ['Embedded Systems Laboratory', 'Resistor Kit', 'Consumable', '580', '0', '—', '—'],
    ],
    approvals: [
      ['Lecturer', 'Dr. R. Silva', 'Electronics Laboratory', '12', '3', '1 day', 'Active'],
      ['Lecturer', 'Dr. M. Fernando', 'Robotics Laboratory', '8', '2', '2 days', 'Active'],
      ['HOD', 'Current HOD', 'Department-wide', '16', '9', '1 day', 'Active'],
    ],
  }[type];
  const heads = {
    borrowed: ['Batch', 'Laboratory', 'Equipment', 'Borrower', 'Lecturer', 'Issued by', 'Status'],
    overdue: ['Batch', 'Laboratory', 'Equipment', 'Borrower', 'Due date', 'Late by', 'Status'],
    inventory: [
      'Laboratory',
      'Equipment',
      'Type',
      'Available',
      'Reserved',
      'Borrowed',
      'Inspection',
    ],
    approvals: ['Stage', 'Approver', 'Laboratory', 'Decided', 'Pending', 'Median time', 'Status'],
  }[type];
  let filtered = rows.filter(
    (r) =>
      (state.reportBatch === 'All batches' ||
        type === 'inventory' ||
        type === 'approvals' ||
        r[0] === state.reportBatch) &&
      (state.reportLab === 'All laboratories' || r.includes(state.reportLab)) &&
      (state.reportStatus === 'All statuses' ||
        r.some((x) => String(x).toLowerCase() === state.reportStatus.toLowerCase())) &&
      (type !== 'borrowed' ||
        ((state.reportCategory === 'All categories' ||
          inventory.some((i) => i.name === r[2] && i.category === state.reportCategory)) &&
          (!state.reportBorrower ||
            r[3].toLowerCase().includes(state.reportBorrower.toLowerCase())) &&
          (state.reportLecturer === 'All lecturers' || r[4] === state.reportLecturer) &&
          (state.reportOfficer === 'All issuing officers' || r[5] === state.reportOfficer)))
  );
  return `<div class="surfaceBody"><div class="columns"><div><div class="subhead">${header} · illustrative demonstration</div><div style="font-size:11px;color:#7c8799">${type === 'inventory' ? 'Balances are shown per item and unit type. Consumables are not aggregated with returnable units.' : 'The production report must respect all selected filters, row-level access rules and date boundaries.'}</div></div><div class="actions" style="justify-content:flex-end">${badge(`${filtered.length} matching sample rows`, 'blue')}${badge('Synthetic data')}</div></div></div>${table(
    heads,
    filtered.map(
      (r) =>
        `<tr>${r.map((v, i) => `<td>${i === heads.length - 1 && (v === 'Overdue' || v === 'Borrowed' || v === 'Active' || v === 'Returned') ? approveStatus(v) : esc(v)}</td>`).join('')}</tr>`
    ),
    `<span>${filtered.length} records · sample only</span><span>Production: export permissions, redaction and spreadsheet safety required</span>`
  )}`;
}
function applyReport() {
  state.reportBatch = getFilter('rBatch');
  state.reportLab = getFilter('rLab');
  state.reportStatus = getFilter('rStatus');
  state.reportDateStart = getFilter('rStart');
  state.reportDateEnd = getFilter('rEnd');
  if (state.advancedReports) {
    state.reportCategory = getFilter('rCategory');
    state.reportBorrower = getFilter('rBorrower');
    state.reportLecturer = getFilter('rLecturer');
    state.reportOfficer = getFilter('rOfficer');
  }
  render();
  const vals = {
    rBatch: state.reportBatch,
    rLab: state.reportLab,
    rStatus: state.reportStatus,
    rStart: state.reportDateStart,
    rEnd: state.reportDateEnd,
    rCategory: state.reportCategory,
    rBorrower: state.reportBorrower,
    rLecturer: state.reportLecturer,
    rOfficer: state.reportOfficer,
  };
  for (let [id, v] of Object.entries(vals)) {
    const el = document.getElementById(id);
    if (el && v) el.value = v;
  }
  toast('Illustrative report filter applied. The production UI must query server-side data.');
}
function exportDemoCsv() {
  const data = [
    ['Record', 'Laboratory', 'Batch', 'Status'],
    ['REQ-2026-0148', 'Electronics Laboratory', '2023', 'Pending HOD'],
  ];
  let csv = data
    .map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SAMPLE-ONLY-report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Demo CSV exported. Not a production report.');
}
function inventoryPage() {
  let rows = inventory.filter((it) =>
    it.name.toLowerCase().includes((state.searches.inventory || '').toLowerCase())
  );
  return (
    head(
      'Equipment accountability',
      'Inventory oversight',
      'Review per-laboratory quantities, available stock, identified assets, maintenance holds and catalogue policies.',
      `${button('Stock adjustments', 'navTo("adjustments")', '', 'clipboardCheck')}${button('Catalogue administration', 'openCatalogueModal()', 'primary', 'plus')}`
    ) +
    `<div class="banner"><span style="display:flex;align-items:center;gap:9px">${icon('alert')} 1 sample item has an unconfigured approval policy. Items without an authorized policy must not be silently made requestable.</span>${button('Review policies', 'navTo("policies")', 'small')}</div>` +
    `${surface('Department stock position', `<div class="surfaceBody"><div class="miniGrid"><div class="miniItem"><strong>146</strong><span>Available returnable</span></div><div class="miniItem"><strong>17</strong><span>Reserved</span></div><div class="miniItem"><strong>42</strong><span>Borrowed</span></div><div class="miniItem"><strong>11</strong><span>Inspection</span></div><div class="miniItem"><strong>6</strong><span>Maintenance</span></div></div><p class="help">Returnable unit totals only. Consumables must be reported by their own units of measure.</p></div>`, '', 'Consolidated returnable stock across selected scope')}<div class="space surface"><div class="filterbar">${field('Equipment', 'invSearch', 'Search equipment name...', 'search')}${field('Laboratory', 'invLab', ['All laboratories', ...labs.map((l) => l.name)])}${field('Type', 'invType', ['All types', 'Returnable', 'Consumable'])}${field('Policy', 'invPolicy', ['All policies', 'None', 'Lecturer', 'HOD', 'Both', 'Unconfigured'])}${button('Filter', 'filterInventory()', 'primary', 'filter')}</div><div id="invTable">${inventoryTable(rows)}</div></div>`
  );
}
function inventoryTable(data) {
  return table(
    [
      'Item',
      'Laboratory',
      'Type',
      'Available',
      'Reserved',
      'Borrowed',
      'Inspection',
      'Maintenance',
      'Policy',
      '',
    ],
    data.map(
      (it) =>
        `<tr class="rowHover" onclick="showInventory(${it.id})"><td><div class="strong">${esc(it.name)}</div><small>${esc(it.category)}</small></td><td>${esc(it.lab)}</td><td>${badge(it.type)}</td><td>${it.avail}</td><td>${it.res}</td><td>${it.type === 'Consumable' ? '—' : it.borrowed}</td><td>${it.type === 'Consumable' ? '—' : it.inspect}</td><td>${it.type === 'Consumable' ? '—' : it.maint}</td><td>${pillPolicy(it.policy)}</td><td>${button('Details', `event.stopPropagation();showInventory(${it.id})`, 'small', 'arrow')}</td></tr>`
    ),
    `<span>${data.length} catalogue entries</span><span>Open item to review ledger-backed balances</span>`
  );
}
function filterInventory() {
  const q = getFilter('invSearch').toLowerCase(),
    lab = getFilter('invLab'),
    type = getFilter('invType'),
    policy = getFilter('invPolicy');
  const rows = inventory.filter(
    (x) =>
      x.name.toLowerCase().includes(q) &&
      (lab === 'All laboratories' || lab === x.lab) &&
      (type === 'All types' || type === x.type) &&
      (policy === 'All policies' || policy === x.policy)
  );
  document.getElementById('invTable').innerHTML = inventoryTable(rows);
  toast(`${rows.length} matching sample items`);
}
function showInventory(id) {
  const it = inventory.find((x) => x.id === id);
  openDrawer(
    `<div class="eyebrow">Inventory oversight</div><div class="drawerTitle">${esc(it.name)}</div><div class="subtitle">${esc(it.lab)} · ${esc(it.category)}</div>`,
    `<div class="callout">This panel is illustrative. Production quantities must be read from transaction-safe inventory endpoints.</div><div class="detailMeta"><div><span>Available</span><strong>${it.avail}</strong></div><div><span>Reserved</span><strong>${it.res}</strong></div><div><span>Borrowed</span><strong>${it.borrowed}</strong></div><div><span>Inspection</span><strong>${it.inspect}</strong></div><div><span>Maintenance</span><strong>${it.maint}</strong></div><div><span>Item type</span><strong>${it.type}</strong></div></div><div class="detailSection"><h4>Borrowing policy</h4>${pillPolicy(it.policy)}</div><div class="detailSection"><h4>Catalogue description</h4><p>${esc(it.desc)}</p></div><div class="detailSection"><h4>What the admin can do</h4><ul class="ruleList"><li>Inspect stock movement history and audit references.</li><li>Maintain item definitions under authorized capabilities.</li><li>Review independent stock adjustment requests.</li><li>Inspect physical asset identities without changing custody.</li></ul></div>`,
    `${button('Close', 'closeDrawer()')}${button('Open approval policy', `closeDrawer();navTo('policies')`, 'primary', 'sliders')}`
  );
}
function openCatalogueModal() {
  showModal(
    'Catalogue administration',
    'Manage catalogue records with the existing restricted backend APIs. This prototype does not create items.',
    `<div class="modalFields">${field('New item name', 'newItem', 'e.g. Digital Logic Trainer')}${field('Laboratory', 'newItemLab', ['Electronics Laboratory', 'Embedded Systems Laboratory', 'Robotics Laboratory', 'Instrumentation Laboratory'])}${field('Item type', 'newItemType', ['Returnable', 'Consumable'])}</div>`,
    `${button('Cancel', 'hideModal()')}${button('Create sample item', 'demoCreateItem()', 'primary', 'plus')}`
  );
}
function demoCreateItem() {
  const n = getFilter('newItem');
  if (!n.trim()) {
    toast('Enter a name first.');
    return;
  }
  inventory.push({
    id: Date.now(),
    name: n,
    category: 'Uncategorized',
    lab: getFilter('newItemLab'),
    type: getFilter('newItemType'),
    avail: 0,
    res: 0,
    borrowed: 0,
    inspect: 0,
    maint: 0,
    policy: 'Unconfigured',
    desc: 'Sample item – not persisted',
  });
  hideModal();
  render();
  toast('Sample item added locally. Production must validate and persist.');
}
function approvalsPage() {
  return (
    head(
      'Item-level decisions',
      'HOD approval inbox',
      'Review only the HOD-stage items currently assigned to your identity; lecturer decisions and conflicts remain independently enforced.',
      `${button('Approval policy guide', 'navTo("policies")')}`
    ) +
    `<div class="stats">${stat('Awaiting HOD decisions', '9', 'Across current authorized scope', 'clipboard')}${stat('Completed this month', '16', 'Independent HOD-stage decisions', 'checkcircle')}${stat('Requiring review', '3', 'Requests with additional context', 'alert')}${stat('Conflicts blocked', '1', 'Self-approval is never permitted', 'lock')}</div><div class="split"><section class="surface"><div class="filterbar">${field('Search assigned requests', 'approvalSearch', 'Request, borrower, purpose...', 'search')}${field('Status', 'approvalStatus', ['Awaiting my decision', 'All assigned', 'Completed'])}${button('Search', 'filterApprovals()', '', 'search')}</div><div id="approvalTable">${approvalTable(requests)}</div></section><section class="surface" id="approvalDetail">${approvalDetail()}</section></div>`
  );
}
function approvalTable(rows) {
  return table(
    ['Request / item', 'Borrower', 'Lab', 'Submitted', 'Stage', ''],
    rows.map(
      (r) =>
        `<tr class="rowHover ${r.id === state.selectedApproval ? 'selected' : ''}" onclick="state.selectedApproval='${r.id}';document.getElementById('approvalDetail').innerHTML=approvalDetail();document.getElementById('approvalTable').innerHTML=approvalTable(requests)"><td><span class="strong">${r.id}</span><small>${esc(r.items)}</small></td><td>${esc(r.name)}<small>${r.borrower}</small></td><td>${esc(r.lab).split(' ')[0]}</td><td>${r.date.slice(5)}</td><td>${badge(r.self ? 'Conflict' : 'HOD review', r.self ? 'red' : 'amber')}</td><td>${icon('arrow')}</td></tr>`
    ),
    `<span>${rows.length} sample HOD-stage records</span><span>Only eligible request lines can be decided</span>`
  );
}
function filterApprovals() {
  const q = getFilter('approvalSearch').toLowerCase();
  let rows = requests.filter((r) =>
    [r.id, r.name, r.items, r.purpose].some((s) => s.toLowerCase().includes(q))
  );
  document.getElementById('approvalTable').innerHTML = approvalTable(rows);
}
function approvalDetail() {
  const r = requests.find((x) => x.id === state.selectedApproval);
  if (!r)
    return `<div class="rightPanelEmpty">${icon('clipboard')}<strong>Select a request</strong><p>Choose an assigned record to review its item-level stages.</p></div>`;
  return `<div class="surfaceHeader"><div><div class="surfaceTitle">${r.id}</div><div class="surfaceSub">${esc(r.name)} · ${r.borrower} · Batch ${r.batch}</div></div>${badge(r.self ? 'Blocked: self-approval' : 'Awaiting HOD', r.self ? 'red' : 'amber')}</div><div class="detail"><div class="detailMeta"><div><span>Laboratory</span><strong>${esc(r.lab)}</strong></div><div><span>Requested date</span><strong>${r.date}</strong></div><div><span>Lecturer stage</span><strong>${esc(r.lecturer)}</strong></div><div><span>Approval policy</span><strong>${r.policy === 'Both' ? 'Lecturer → HOD' : 'HOD only'}</strong></div></div><div class="detailSection"><h4>Borrowing purpose</h4><p>${esc(r.purpose)}</p></div><div class="detailSection"><h4>Requested items / decisions</h4><div class="detailLine"><div><strong>${esc(r.id === 'REQ-2026-0148' ? 'Oscilloscope ×1' : r.items)}</strong><small>HOD-eligible request line · approval policy ${r.policy === 'Both' ? 'Lecturer → HOD' : 'HOD'}</small></div>${badge('HOD decision required', 'amber')}</div>${r.id === 'REQ-2026-0148' ? `<div class="detailLine"><div><strong>Digital Multimeter ×1</strong><small>Separate lecturer-only line · not eligible for HOD decision</small></div>${badge('Lecturer approved', 'green')}</div>` : ''}</div><div class="detailSection"><h4>Decision remark</h4><div class="field"><label for="decisionRemark">Optional explanation or reason</label><textarea id="decisionRemark" placeholder="Write an academic decision remark..."></textarea></div></div>${r.self ? `<div class="banner">${icon('lock')} Self-approval is prohibited. An eligible independent approver is required.</div>` : ''}<div class="detailBtns">${button('View complete request', 'openRequestDrawer()', '', 'eye')}${button('Reject eligible line', `decideApproval('Rejected')`, 'danger')}${button('Approve eligible line', `decideApproval('Approved')`, 'primary', 'check')}</div><p class="help">Approval never issues equipment. A technical officer separately verifies physical handover.</p></div>`;
}
function decideApproval(dec) {
  let r = requests.find((x) => x.id === state.selectedApproval);
  if (r.self) {
    toast('Blocked: no self-approval. Independent authorized substitute required.');
    return;
  }
  showModal(
    `${dec} HOD stage?`,
    `This demonstrates the review confirmation only; real decisions require server-side identity, line-level authorization and transactional history.`,
    `<div class="callout"><strong>${r.id}</strong> · ${esc(r.items)}<br>Decision: ${dec}<br>Remark: ${esc(getFilter('decisionRemark') || 'No remark')}</div>`,
    `${button('Cancel', 'hideModal()')}${button('Confirm sample decision', `commitApproval('${dec}')`, 'primary')}`
  );
}
function commitApproval(dec) {
  let id = state.selectedApproval;
  requests = requests.filter((x) => x.id !== id);
  state.selectedApproval = requests[0]?.id || null;
  hideModal();
  render();
  toast(`Sample HOD decision recorded locally (${dec}). No database was changed.`);
}
function openRequestDrawer() {
  const r = requests.find((x) => x.id === state.selectedApproval);
  openDrawer(
    `<div class="eyebrow">Assigned request</div><div class="drawerTitle">${r.id}</div><div class="subtitle">Review the complete borrower context</div>`,
    `<div class="detailMeta"><div><span>Borrower</span><strong>${esc(r.name)} · ${r.borrower}</strong></div><div><span>Academic batch</span><strong>${esc(r.batch)}</strong></div><div><span>Laboratory</span><strong>${esc(r.lab)}</strong></div><div><span>Approval requirement</span><strong>${r.policy === 'Both' ? 'Lecturer then HOD' : 'HOD'}</strong></div></div><div class="detailSection"><h4>Items</h4><div class="detailLine">${esc(r.items)}</div></div><div class="detailSection"><h4>Purpose</h4><p>${esc(r.purpose)}</p></div><div class="detailSection"><h4>Controls</h4><ul class="ruleList"><li>Server checks acting user's current HOD authority.</li><li>No self-approval or unauthorized substitute.</li><li>Remarks and approval decisions remain immutable.</li><li>Final approval attempts stock reservation; never physical issue.</li></ul></div>`,
    button('Close', 'closeDrawer()')
  );
}
function adjustmentsPage() {
  return (
    head(
      'Independent stock reconciliation',
      'Stock adjustment reviews',
      'Approve or reject proposed ledger corrections independently; no direct silent inventory edits and no proposer self-approval.',
      button('Inventory overview', 'navTo("inventory")', '', 'package')
    ) +
    `<div class="stats">${stat('Awaiting independent review', '3', 'Sample proposals', 'clipboard')}${stat('Approved this month', '12', 'Authorized controlled corrections', 'checkcircle')}${stat('Proposer conflicts', '1', 'Must be assigned elsewhere', 'lock')}${stat('Unresolved discrepancies', '2', 'Require evidence and follow-up', 'alert')}</div><div class="surface"><div class="filterbar">${field('Search proposals', 'adjustmentSearch', 'Item, reference, proposer...', 'search')}${field('Status', 'adjustmentStatus', ['All statuses', 'Pending', 'Approved', 'Rejected'])}${button('Filter', 'filterAdjustments()', 'primary', 'filter')}</div><div id="adjustmentsTable">${adjustmentsTable(adjustments)}</div></div>`
  );
}
function adjustmentsTable(data) {
  return table(
    ['Proposal', 'Item / lab', 'Proposed change', 'Proposed by', 'Reason', 'Status', 'Action'],
    data.map(
      (a) =>
        `<tr><td><div class="strong">${a.id}</div><small>${a.submitted}</small></td><td><div class="strong">${esc(a.item)}</div><small>${esc(a.lab)}</small></td><td><strong>${a.change}</strong></td><td>${esc(a.proposer)}</td><td>${esc(a.reason)}</td><td>${approveStatus(a.status)}</td><td>${button('Review', `openAdjustment('${a.id}')`, 'small', 'arrow')}</td></tr>`
    ),
    `<span>${data.length} proposals</span><span>Decisions must have a durable, independent audit trail</span>`
  );
}
function filterAdjustments() {
  let q = getFilter('adjustmentSearch').toLowerCase(),
    s = getFilter('adjustmentStatus');
  let filtered = adjustments.filter(
    (a) =>
      (s === 'All statuses' || a.status === s) &&
      [a.id, a.item, a.proposer, a.reason].some((x) => x.toLowerCase().includes(q))
  );
  document.getElementById('adjustmentsTable').innerHTML = adjustmentsTable(filtered);
}
function openAdjustment(id) {
  let a = adjustments.find((x) => x.id === id);
  openDrawer(
    `<div class="eyebrow">Stock adjustment proposal</div><div class="drawerTitle">${id}</div><div class="subtitle">${esc(a.item)} · ${esc(a.lab)}</div>`,
    `<div class="detailMeta"><div><span>Quantity change</span><strong>${a.change}</strong></div><div><span>Proposed by</span><strong>${esc(a.proposer)}</strong></div><div><span>Submitted</span><strong>${a.submitted}</strong></div><div><span>State</span><strong>${a.status}</strong></div></div><div class="detailSection"><h4>Justification</h4><p>${esc(a.reason)}</p></div><div class="detailSection"><h4>Independent approval</h4>${a.self ? `<div class="banner">This sample proposal was submitted by the current administrator. Self-approval is blocked.</div>` : '<p>Independent authenticated reviewer and evidence verification required.</p>'}</div>`,
    `${button('Close', 'closeDrawer()')}${button('Reject', `adjustDecision('${id}','Rejected')`, 'danger')}${button('Approve', `adjustDecision('${id}','Approved')`, 'primary', 'check')}`
  );
}
function adjustDecision(id, s) {
  let a = adjustments.find((x) => x.id === id);
  if (a.self) {
    toast('Blocked: independent reviewer required.');
    return;
  }
  if (a.status !== 'Pending') {
    toast('Only pending proposals can be decided.');
    return;
  }
  a.status = s;
  closeDrawer();
  render();
  toast(`Demo adjustment ${id}: ${s}. No backend ledger was mutated.`);
}
function usersPage() {
  return (
    head(
      'Identity and access',
      'Users & access',
      'Manage people, multiple roles, student registration details, academic batches and authorized laboratory assignments.',
      `${button('Import accounts', 'openUserImport()', '', 'download')}${button('Create user', 'openUserModal()', 'primary', 'plus')}`
    ) +
    `${surface('Account administration', `<div class="surfaceBody"><div class="columns equal"><div class="note">The same person can hold several roles. Assignments and account status are checked server-side on every protected operation.</div><div class="actions" style="justify-content:flex-end">${badge('9 synthetic accounts', 'blue')}${badge('1 disabled account')}</div></div></div>`, '', 'Current synthetic development directory')}<div class="space surface"><div class="filterbar">${field('Search users', 'userSearch', 'Name, email, student registration...', 'search')}${field('Role', 'userRole', ['All roles', 'Student', 'Lecturer', 'Technical Officer', 'HOD/Admin'])}${field('Account status', 'userStatus', ['All statuses', 'Active', 'Disabled'])}${button('Filter', 'filterUsers()', 'primary', 'search')}</div><div id="usersTable">${usersTable(users)}</div></div>`
  );
}
function usersTable(data) {
  return table(
    ['Person', 'Account', 'Roles', 'Batch / registration', 'Laboratory assignment', 'Status', ''],
    data.map(
      (u) =>
        `<tr class="rowHover" onclick="openUserDetails(${u.id})"><td><div class="strong">${esc(u.name)}</div></td><td>${esc(u.email)}</td><td>${u.roles.map((r) => badge(r, r === 'HOD/Admin' ? 'maroon' : r === 'Student' ? 'blue' : '')).join(' ')}</td><td>${esc(u.batch)}${u.registration ? `<small>${esc(u.registration)}</small>` : ''}</td><td>${esc(u.labs)}</td><td>${approveStatus(u.status)}</td><td>${button('Manage', `event.stopPropagation();openUserDetails(${u.id})`, 'small', 'arrow')}</td></tr>`
    ),
    `<span>${data.length} accounts</span><span>Changes require admin authorization and immutable audit records</span>`
  );
}
function filterUsers() {
  let q = getFilter('userSearch').toLowerCase(),
    role = getFilter('userRole'),
    s = getFilter('userStatus');
  let rows = users.filter(
    (u) =>
      (role === 'All roles' || u.roles.includes(role)) &&
      (s === 'All statuses' || s === u.status) &&
      [u.name, u.email, u.batch, u.labs].some((v) => v.toLowerCase().includes(q))
  );
  document.getElementById('usersTable').innerHTML = usersTable(rows);
}
function openUserDetails(id) {
  let u = users.find((x) => x.id === id);
  openDrawer(
    `<div class="eyebrow">Account management</div><div class="drawerTitle">${esc(u.name)}</div><div class="subtitle">${esc(u.email)}</div>`,
    `<div class="detailMeta"><div><span>Account status</span><strong>${u.status}</strong></div><div><span>Roles</span><strong>${u.roles.join(', ')}</strong></div><div><span>Academic batches</span><strong>${esc(u.batch)}</strong></div><div><span>Registration number</span><strong>${esc(u.registration || 'Not applicable')}</strong></div><div><span>Laboratory assignments</span><strong>${esc(u.labs)}</strong></div></div><div class="detailSection"><h4>Managing access</h4><ul class="ruleList"><li>Multiple concurrent roles are supported.</li><li>Student memberships may cover multiple academic batches.</li><li>Role and laboratory assignment updates must be audited.</li><li>Disabled accounts lose access through session revocation.</li><li>No administrator can use a privilege to bypass own-request conflicts.</li></ul></div>`,
    `${button('Close', 'closeDrawer()')}${button('Edit account', `closeDrawer();openUserModal(${u.id})`, 'primary', 'edit')}`
  );
}
function groupBoxes(label, name, choices, selected = []) {
  return `<div class="formDivider"><div class="formCaption">${label}</div><div class="checkGrid">${choices.map((ch) => `<label class="checkOption"><input type="checkbox" name="${name}" value="${esc(ch)}" ${selected.includes(ch) ? 'checked' : ''}>${esc(ch)}</label>`).join('')}</div></div>`;
}
function checks(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
}
function openUserModal(id) {
  let u = users.find((x) => x.id === id);
  let selectedBatches = u ? (u.batch === '—' ? [] : u.batch.split(',').map((x) => x.trim())) : [];
  let selectedLabs = u
    ? u.labs === '—' || u.labs === 'Department-wide'
      ? []
      : u.labs.split(',').map((x) => x.trim())
    : [];
  showModal(
    u ? 'Edit user account' : 'Create user account',
    'Demonstration form showing multiple roles, academic batch memberships, staff lab assignments and account status.',
    `<div class="modalFields">${field('Full name', 'userName', 'e.g. Student / Lecturer full name')}${field('Email address', 'userEmail', 'name@example.invalid')}${field('Student registration number', 'userReg', 'Optional for staff; required for students')}${groupBoxes('Roles — select one or more', 'editRole', ['Student', 'Lecturer', 'Technical Officer', 'HOD/Admin'], u ? u.roles : ['Student'])}${groupBoxes(
      'Academic batch memberships',
      'editBatch',
      batches.map((b) => b.name),
      selectedBatches
    )}${groupBoxes(
      'Assigned laboratories — staff permissions',
      'editLab',
      labs.map((l) => l.name),
      selectedLabs
    )}${field('Account status', 'userAccountStatus', ['Active', 'Disabled'])}</div><p class="help">Production requires server-side uniqueness, per-record authorization, historical membership integrity and session revocation on access changes.</p>`,
    `${button('Cancel', 'hideModal()')}${button(u ? 'Save sample changes' : 'Create sample user', `saveSampleUser(${id || 'null'})`, 'primary', 'check')}`
  );
  if (u) {
    document.getElementById('userName').value = u.name;
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userAccountStatus').value = u.status;
    document.getElementById('userReg').value = u.registration || '';
  }
}
function saveSampleUser(id) {
  let n = getFilter('userName').trim(),
    mail = getFilter('userEmail').trim(),
    r = checks('editRole'),
    bs = checks('editBatch'),
    ls = checks('editLab'),
    reg = getFilter('userReg').trim();
  if (!n || !mail.includes('@') || r.length === 0) {
    toast('Enter a name, email and at least one role.');
    return;
  }
  if (r.includes('Student') && (!bs.length || !reg)) {
    toast('Student accounts require registration number and batch membership.');
    return;
  }
  let u = users.find((x) => x.id === id),
    v = {
      name: n,
      email: mail,
      roles: r,
      batch: bs.join(', ') || '—',
      labs: ls.join(', ') || '—',
      registration: reg,
      status: getFilter('userAccountStatus'),
    };
  if (u) Object.assign(u, v);
  else users.push({ id: Date.now(), ...v });
  hideModal();
  render();
  toast('Account example saved locally, with multiple memberships; no real account was changed.');
}
function openUserImport() {
  showModal(
    'User account import',
    'For the real system, institutional account imports require explicit approved schema, identity matching and data-protection controls.',
    '<div class="callout">Do not import real student or staff data into this prototype. Synthetic sample records only.</div>',
    `${button('Close', 'hideModal()')}`
  );
}
function batchesPage() {
  return (
    head(
      'Academic structure',
      'Academic batches',
      'Manage academic cohorts and associate each student with the correct registration number and one or more batch memberships.',
      button('Create batch', 'openBatchModal()', 'primary', 'plus')
    ) +
    `${surface('Academic batch directory', `<div class="surfaceBody"><div class="note">A batch is an academic cohort—not a stock lot or equipment category. HOD reporting uses batch memberships with appropriate privacy controls.</div></div>`, '', 'Department-wide administration')}<div class="space surface"><div class="filterbar">${field('Search batch', 'batchSearch', 'Year or batch reference...', 'search')}${button('Search', 'filterBatches()', '', 'search')}</div><div id="batchTable">${batchesTable(batches)}</div></div>`
  );
}
function batchesTable(data) {
  return table(
    ['Academic batch', 'Reference', 'Enrolled students', 'Status', 'Actions'],
    data.map(
      (b) =>
        `<tr class="rowHover" onclick="openBatchDetails(${b.id})"><td><span class="strong">Engineering · ${esc(b.name)}</span></td><td>${esc(b.code)}</td><td>${b.students}</td><td>${approveStatus(b.status)}</td><td>${button('View / Edit', `event.stopPropagation();openBatchDetails(${b.id})`, 'small', 'edit')}</td></tr>`
    ),
    `<span>${data.length} batches</span><span>Registration and multi-batch membership managed in Users & Access</span>`
  );
}
function filterBatches() {
  let q = getFilter('batchSearch').toLowerCase();
  document.getElementById('batchTable').innerHTML = batchesTable(
    batches.filter((b) => (b.name + b.code).toLowerCase().includes(q))
  );
}
function openBatchDetails(id) {
  let b = batches.find((x) => x.id === id);
  openDrawer(
    `<div class="eyebrow">Academic batch</div><div class="drawerTitle">Engineering ${b.name}</div><div class="subtitle">${b.code}</div>`,
    `<div class="detailMeta"><div><span>Registered students</span><strong>${b.students}</strong></div><div><span>Status</span><strong>${b.status}</strong></div></div><div class="detailSection"><h4>Illustrative memberships</h4>${
      students
        .filter((s) => s.batch === b.name)
        .map(
          (s) =>
            `<div class="detailLine"><span>${esc(s.name)}</span><strong>${s.reg}</strong></div>`
        )
        .join('') || '<p>No sample students shown for this batch.</p>'
    }</div><div class="detailSection"><h4>Available controls</h4><ul class="ruleList"><li>Rename or deactivate where allowed.</li><li>Manage student membership via validated account records.</li><li>Retain historical batch associations for existing borrowing records.</li><li>Use batch filters in authorized reports and exports.</li></ul></div>`,
    `${button('Close', 'closeDrawer()')}${button('Edit batch', `closeDrawer();openBatchModal(${id})`, 'primary', 'edit')}`
  );
}
function openBatchModal(id) {
  let b = batches.find((x) => x.id === id);
  showModal(
    b ? 'Edit academic batch' : 'Create academic batch',
    'Manage cohort labels; do not rename historical records without preserving identity and history.',
    `<div class="modalFields">${field('Batch year or name', 'batchName', 'e.g. 2026')}${field('Reference code', 'batchCode', 'ENG-2026')}${field('Status', 'batchStatus', ['Active', 'Inactive'])}</div>`,
    `${button('Cancel', 'hideModal()')}${button('Save sample batch', `saveBatch(${id || 'null'})`, 'primary', 'check')}`
  );
  if (b) {
    document.getElementById('batchName').value = b.name;
    document.getElementById('batchCode').value = b.code;
    document.getElementById('batchStatus').value = b.status;
  }
}
function saveBatch(id) {
  let name = getFilter('batchName').trim(),
    code = getFilter('batchCode').trim();
  if (!name || !code) {
    toast('Both fields are required.');
    return;
  }
  let b = batches.find((x) => x.id === id);
  if (b) {
    b.name = name;
    b.code = code;
    b.status = getFilter('batchStatus');
  } else
    batches.push({ id: Date.now(), name, code, students: 0, status: getFilter('batchStatus') });
  hideModal();
  render();
  toast('Sample batch saved in prototype state only.');
}
function labsPage() {
  return (
    head(
      'Department facilities',
      'Laboratories',
      'Oversee authorized laboratories, technical officer assignments, equipment holdings, locations and active status.',
      button('Create laboratory', 'openLabModal()', 'primary', 'plus')
    ) +
    `${surface('Laboratory directory', `<div class="surfaceBody"><div class="note">Changes to lab assignments and stock ownership must not silently move inventory, custody or in-transit equipment. Preserve location-specific accounting.</div></div>`, '', 'Department laboratories and operational scope')}<div class="space surface"><div class="filterbar">${field('Search laboratory', 'labSearch', 'Name, code or location...', 'search')}${button('Search', 'filterLabs()', '', 'search')}</div><div id="labTable">${labsTable(labs)}</div></div>`
  );
}
function labsTable(data) {
  return table(
    [
      'Laboratory',
      'Code',
      'Assigned technical officers',
      'Available returnable units',
      'Currently borrowed',
      'Status',
      '',
    ],
    data.map(
      (l) =>
        `<tr class="rowHover" onclick="openLab(${l.id})"><td><span class="strong">${esc(l.name)}</span></td><td>${l.code}</td><td>${l.officers}</td><td>${l.available}</td><td>${l.borrowed}</td><td>${approveStatus(l.status)}</td><td>${button('Manage', `event.stopPropagation();openLab(${l.id})`, 'small', 'arrow')}</td></tr>`
    ),
    `<span>${data.length} laboratories</span><span>Only authorized assignments and capabilities permit modifications</span>`
  );
}
function filterLabs() {
  let q = getFilter('labSearch').toLowerCase();
  document.getElementById('labTable').innerHTML = labsTable(
    labs.filter((l) => (l.name + l.code).toLowerCase().includes(q))
  );
}
function openLab(id) {
  let l = labs.find((x) => x.id === id);
  openDrawer(
    `<div class="eyebrow">Department laboratory</div><div class="drawerTitle">${esc(l.name)}</div><div class="subtitle">${l.code}</div>`,
    `<div class="detailMeta"><div><span>Technical officers</span><strong>${l.officers}</strong></div><div><span>Available returnable units</span><strong>${l.available}</strong></div><div><span>Currently borrowed units</span><strong>${l.borrowed}</strong></div><div><span>Laboratory status</span><strong>${l.status}</strong></div></div><div class="detailSection"><h4>Assigned personnel</h4>${
      users
        .filter((u) => u.labs === l.name)
        .map(
          (u) =>
            `<div class="detailLine"><span>${esc(u.name)}</span><span>${u.roles.join(', ')}</span></div>`
        )
        .join('') || '<p>No assigned sample users.</p>'
    }</div><div class="detailSection"><h4>Controls and history</h4><ul class="ruleList"><li>Manage metadata, assignments and availability scopes.</li><li>Preserve stock movement history.</li><li>Use separate controlled transfers if moving stock between laboratories.</li></ul></div>`,
    `${button('Close', 'closeDrawer()')}${button('Edit laboratory', `closeDrawer();openLabModal(${id})`, 'primary', 'edit')}`
  );
}
function openLabModal(id) {
  let l = labs.find((x) => x.id === id);
  showModal(
    l ? 'Edit laboratory' : 'Create laboratory',
    'This form represents lab metadata editing, not physical stock transfer or custody reassignment.',
    `<div class="modalFields">${field('Laboratory name', 'labName', 'Laboratory name')}${field('Reference code', 'labCode', 'LAB-05')}${field('Status', 'labStatus', ['Active', 'Inactive'])}</div>`,
    `${button('Cancel', 'hideModal()')}${button('Save sample lab', `saveLab(${id || 'null'})`, 'primary', 'check')}`
  );
  if (l) {
    document.getElementById('labName').value = l.name;
    document.getElementById('labCode').value = l.code;
    document.getElementById('labStatus').value = l.status;
  }
}
function saveLab(id) {
  let name = getFilter('labName').trim(),
    code = getFilter('labCode').trim();
  if (!name || !code) {
    toast('Enter laboratory name and reference.');
    return;
  }
  let l = labs.find((x) => x.id === id);
  if (l) {
    l.name = name;
    l.code = code;
    l.status = getFilter('labStatus');
  } else
    labs.push({
      id: Date.now(),
      name,
      code,
      officers: 0,
      borrowed: 0,
      available: 0,
      status: getFilter('labStatus'),
    });
  hideModal();
  render();
  toast('Sample laboratory saved locally. No stock movements occurred.');
}
function policiesPage() {
  return (
    head(
      'Borrowing rules',
      'Equipment approval policies',
      'Control item-specific approval stages. Every request uses the policy snapshot captured at submission; physical handover always remains separate.',
      button('Review pending approvals', 'navTo("approvals")', '', 'clipboard')
    ) +
    `<div class="banner"><span>${icon('alert')} Missing policy is not the same as “No approval.” Block new requests until the approval policy has been configured.</span></div><div class="surface"><div class="filterbar">${field('Search equipment', 'policySearch', 'Item name, category...', 'search')}${field('Approval requirement', 'policyFilter', ['All policies', 'None', 'Lecturer', 'HOD', 'Both', 'Unconfigured'])}${button('Apply', 'filterPolicies()', 'primary', 'filter')}</div><div id="policyTable">${policiesTable(inventory)}</div></div><div class="space surface"><div class="surfaceBody"><div class="subhead">Available approval policies</div><div class="actions" style="gap:10px">${pillPolicy('None')}${pillPolicy('Lecturer')}${pillPolicy('HOD')}${pillPolicy('Both')}${pillPolicy('Unconfigured')}</div><p class="help">Combined policy = lecturer first, HOD second. Borrower selects an eligible lecturer where lecturer approval is required. Server validates current authority and prevents self-approval.</p></div></div>`
  );
}
function policiesTable(data) {
  return table(
    ['Equipment', 'Category', 'Laboratory', 'Current policy', 'Availability', 'Action'],
    data.map(
      (it) =>
        `<tr><td><span class="strong">${esc(it.name)}</span></td><td>${esc(it.category)}</td><td>${esc(it.lab)}</td><td>${pillPolicy(it.policy)}</td><td>${it.avail} ${it.type === 'Returnable' ? 'units' : 'quantity'}</td><td>${button('Configure', `openPolicyModal(${it.id})`, 'small', 'sliders')}</td></tr>`
    ),
    `<span>${data.length} catalogue items</span><span>Policy changes must be audited and should not retroactively rewrite submitted requests</span>`
  );
}
function filterPolicies() {
  let q = getFilter('policySearch').toLowerCase(),
    p = getFilter('policyFilter');
  document.getElementById('policyTable').innerHTML = policiesTable(
    inventory.filter(
      (x) => x.name.toLowerCase().includes(q) && (p === 'All policies' || x.policy === p)
    )
  );
}
function openPolicyModal(id) {
  let it = inventory.find((x) => x.id === id);
  showModal(
    'Configure borrowing approval policy',
    `${it.name} · ${it.lab}. Existing submitted requests retain their original approval snapshots.`,
    `<div class="modalFields"><div class="field"><label for="newPolicy">Approval requirement</label><select id="newPolicy"><option value="None">No academic approval</option><option value="Lecturer">Lecturer approval only</option><option value="HOD">HOD approval only</option><option value="Both">Lecturer then HOD</option><option value="Unconfigured">Unconfigured — not requestable</option></select></div><div class="callout">Independent authorization is always required. No approval setting makes the technical officer's physical handover optional.</div></div>`,
    `${button('Cancel', 'hideModal()')}${button('Save sample policy', `savePolicy(${id})`, 'primary', 'check')}`
  );
  document.getElementById('newPolicy').value = it.policy;
}
function savePolicy(id) {
  let it = inventory.find((x) => x.id === id);
  it.policy = getFilter('newPolicy');
  hideModal();
  render();
  toast('Sample policy updated locally. Production must persist a durable audited version.');
}
function auditPage() {
  let active = state.auditTab === 'operations';
  let filtered = audit.filter((a) =>
    active ? ['stock', 'approvals'].includes(a.type) : ['identity', 'security'].includes(a.type)
  );
  return (
    head(
      'Accountability & audit',
      'Audit & history',
      'Inspect authorized operational changes and security-related events in separate, appropriately scoped views.',
      button(
        'Export audit records',
        'toast("Audit export requires authorized server filtering and privacy safeguards.")',
        '',
        'download'
      )
    ) +
    `<section class="surface"><div class="tabbar"><button class="tab ${active ? 'active' : ''}" onclick="state.auditTab='operations';render()">Operations & inventory</button><button class="tab ${!active ? 'active' : ''}" onclick="state.auditTab='security';render()">Identity & security</button></div><div class="filterbar">${field('Search history', 'auditSearch', 'Reference, actor, equipment or event...', 'search')}${field('Event type', 'auditType', ['All types', 'Stock', 'Approval', 'Identity', 'Security'])}${button('Search', 'filterAudit()', '', 'search')}</div><div id="auditList">${auditList(filtered)}</div></section>`
  );
}
function auditList(data) {
  if (!data.length) return '<div class="empty">No matching sample events</div>';
  return `<div>${data.map((a) => `<div class="auditRow"><span class="auditDot"></span><div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div><time>${esc(a.time)}</time></div>`).join('')}</div>`;
}
function filterAudit() {
  const q = getFilter('auditSearch').toLowerCase(),
    type = getFilter('auditType').toLowerCase(),
    allow = state.auditTab === 'operations' ? ['stock', 'approvals'] : ['identity', 'security'];
  let data = audit.filter(
    (a) =>
      allow.includes(a.type) &&
      (type === 'all types' ||
        a.type.includes(type) ||
        (type === 'approval' && a.type === 'approvals')) &&
      (a.title + a.detail).toLowerCase().includes(q)
  );
  document.getElementById('auditList').innerHTML = auditList(data);
}
function personalPage() {
  return (
    head(
      'Personal borrowing',
      'My requests & borrowed equipment',
      'HOD/Admin users can also borrow equipment. Personal requests never bypass item-specific approval rules or conflict restrictions.',
      button('New borrowing request', 'openBorrowingModal()', 'primary', 'plus')
    ) +
    `<div class="stats">${stat('Personal requests', '2', 'Your own records only', 'book')}${stat('Pending approval', '1', 'Independent stage required', 'clock')}${stat('Currently borrowed', '1', 'Unit issued under your identity', 'package')}${stat('Overdue personal items', '0', 'Past expected return date', 'alert')}</div><div class="columns equal">${surface('My requests', table(['Request', 'Items', 'Approval status', 'Collection'], [`<tr><td><span class="strong">REQ-2026-0111</span></td><td>Multimeter ×1</td><td>${badge('Pending HOD', 'amber')}</td><td>Not ready</td></tr>`, `<tr><td><span class="strong">REQ-2026-0102</span></td><td>Arduino Uno ×1</td><td>${badge('Approved', 'green')}</td><td>${badge('Ready to collect', 'green')}</td></tr>`]), button('Browse equipment', 'openBorrowingModal()', 'link', 'arrow'), 'Sample personal borrowing records')}${surface('Currently borrowed', table(['Equipment', 'Qty', 'Expected return', 'Status'], [`<tr><td>Digital Multimeter</td><td>1</td><td>18 Nov 2026</td><td>${badge('Borrowed', 'blue')}</td></tr>`]), '', 'Sample equipment held by the administrator')}</div><div class="space callout">Role conflict: an administrator cannot approve their own borrowing request or hand themselves equipment. The system must route the action to a separate authorized substitute or block it.</div>`
  );
}
function openBorrowingModal() {
  showModal(
    'Personal equipment request',
    'HOD/Admin users have normal borrower rights but no self-approval or self-handover exception.',
    '<div class="modalFields"><div class="field"><label for="bItem">Equipment</label><select id="bItem"><option>Digital Multimeter</option><option>Arduino Uno</option><option>Oscilloscope</option></select></div><div class="field"><label for="bPurpose">Purpose</label><textarea id="bPurpose" placeholder="Explain the academic purpose..."></textarea></div></div>',
    `${button('Cancel', 'hideModal()')}${button('Review sample request', 'toast("Prototype only: real request composer is shared with Student/Lecturer flows.");hideModal()', 'primary')}`
  );
}
function openDrawer(title, content, footer = '') {
  document.getElementById('drawerTitle').innerHTML = title;
  document.getElementById('drawerBody').innerHTML = content;
  document.getElementById('drawerFooter').innerHTML = footer || button('Close', 'closeDrawer()');
  document.getElementById('scrim').classList.add('show');
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawerClose').focus();
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('show');
  if (!document.getElementById('modal').classList.contains('show'))
    document.getElementById('scrim').classList.remove('show');
}
function showModal(title, description, body, footer) {
  document.getElementById('modalBody').innerHTML =
    `<h3 id="modalName">${title}</h3><p>${description}</p>${body}`;
  document.getElementById('modalFooter').innerHTML = footer;
  document.getElementById('scrim').classList.add('show');
  document.getElementById('modal').classList.add('show');
}
function hideModal() {
  document.getElementById('modal').classList.remove('show');
  if (!document.getElementById('drawer').classList.contains('show'))
    document.getElementById('scrim').classList.remove('show');
}
function closeAll() {
  hideModal();
  closeDrawer();
}
function toggleMobile() {
  document.querySelector('.sidebar').classList.toggle('open');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});
document.addEventListener('DOMContentLoaded', () => {
  render();
});
