'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { ReviewSheet } from '@/components/ui/review-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  api,
  ApiError,
  readRows,
  roleLabels,
  displayRoles,
  type Role,
  type Resource,
  type RecordRow,
  type Session,
} from './api';
import { Authenticated, ErrorNotice } from './session';
const labels: Record<Resource, string> = {
  users: 'Users & Access',
  batches: 'Academic Batches',
  laboratories: 'Laboratories',
};
const descriptions: Record<Resource, string> = {
  users: 'Manage roles, account status, academic batches, and authorized laboratory assignments.',
  batches: 'Maintain academic cohorts and review membership before changing availability.',
  laboratories:
    'Maintain laboratory records and review operational dependencies before changing availability.',
};
export function AdminManagement({ resource }: { resource: Resource }) {
  return (
    <Authenticated>
      {(session) =>
        session.user.roles.includes('ADMIN') ? (
          <Management key={resource} resource={resource} session={session} />
        ) : (
          <>
            <h1>Administration unavailable</h1>
            <p role="status">
              Your current account does not have administrative access. Server authorization remains
              authoritative.
            </p>
          </>
        )
      }
    </Authenticated>
  );
}
export function AdminResourceWorkspace({
  resource,
  session,
}: {
  resource: Resource;
  session: Session;
}) {
  return <Management key={resource} resource={resource} session={session} />;
}
function Management({ resource, session }: { resource: Resource; session: Session }) {
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [batches, setBatches] = useState<RecordRow[]>([]);
  const [labs, setLabs] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [labIds, setLabIds] = useState<string[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = (name: Resource) =>
      api<unknown>(`/api/admin/${name}`, { signal: controller.signal }).then(readRows);
    Promise.all([
      load(resource),
      ...(resource === 'users' ? [load('batches'), load('laboratories')] : []),
    ])
      .then(([items, batchItems, labItems]) => {
        if (!controller.signal.aborted) {
          setRows(items);
          setBatches(batchItems ?? []);
          setLabs(labItems ?? []);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Unable to load records.');
          setDenied(error instanceof ApiError && (error.status === 401 || error.status === 403));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [resource, reload]);
  function refresh() {
    setLoading(true);
    setRows([]);
    setError('');
    setDenied(false);
    setReload((value) => value + 1);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError('');
    setNotice('');
    const assignments = { roles, laboratoryIds: labIds, batchIds };
    const body =
      resource === 'users'
        ? editing
          ? {
              ...assignments,
              displayName: String(data.get('displayName')).trim(),
              registrationNumber: String(data.get('registrationNumber')).trim() || null,
              disabled: data.get('disabled') === 'on',
            }
          : {
              ...assignments,
              displayName: String(data.get('displayName')).trim(),
              email: String(data.get('email')).trim(),
              password: String(data.get('password')),
              ...(roles.includes('STUDENT')
                ? { registrationNumber: String(data.get('registrationNumber')).trim() }
                : {}),
            }
        : editing
          ? { name: String(data.get('name')).trim(), active: data.get('active') === 'on' }
          : { name: String(data.get('name')).trim() };
    try {
      await api(`/api/admin/${resource}${editing ? '/' + encodeURIComponent(editing.id) : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        body,
        csrfToken: session.csrfToken,
      });
      setNotice('The server accepted your change. Reloading current records.');
      setEditing(null);
      setFormOpen(false);
      setRoles([]);
      setLabIds([]);
      setBatchIds([]);
      form.reset();
      refresh();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setRows([]);
        setDenied(true);
      }
      setError(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      setSaving(false);
    }
  }
  function edit(row: RecordRow) {
    setFormOpen(true);
    setEditing(row);
    setRoles((row.roles ?? []) as Role[]);
    setLabIds([...(row.laboratoryIds ?? row.labIds ?? [])]);
    setBatchIds([...(row.batchIds ?? (row.batchId ? [row.batchId] : []))]);
    setNotice('');
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  const filteredRows = rows.filter(
    (row) =>
      (row.displayName ?? row.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (row.email ?? '').toLowerCase().includes(query.toLowerCase())
  );
  const student = roles.includes('STUDENT');
  const staff = roles.includes('LECTURER') || roles.includes('TECHNICAL_OFFICER');
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={labels[resource]}
        description="Manage institutional records and access assignments."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setRoles([]);
              setLabIds([]);
              setFormOpen(true);
            }}
          >
            Create {resource === 'users' ? 'user' : resource === 'batches' ? 'batch' : 'laboratory'}
          </Button>
        }
      />
      {error && <ErrorNotice message={error} />}
      <div role="status" className="my-4">
        {notice}
      </div>
      <section className="records mt-6" aria-labelledby="list-heading">
        <div className="section-heading">
          <h2 id="list-heading">Current records</h2>
          <Button variant="outline" disabled={loading || saving} onClick={refresh}>
            Reload
          </Button>
        </div>
        <label className="record-search">
          Search {labels[resource].toLowerCase()}
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
          />
        </label>
        {loading ? (
          <p role="status" className="p-6">
            Loading records...
          </p>
        ) : rows.length ? (
          <div
            className="table-region"
            role="region"
            aria-label={`${labels[resource]} table; scroll for all columns`}
            tabIndex={0}
          >
            <Table>
              <TableCaption>
                Current server records. Academic batches are separate from stock lots.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">{resource === 'users' ? 'Email' : 'Reference'}</TableHead>
                  {resource === 'users' && (
                    <>
                      <TableHead scope="col">Roles / access</TableHead>
                      <TableHead scope="col">Assignments</TableHead>
                      <TableHead scope="col">Action</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.displayName ?? row.name ?? row.id}</TableCell>
                    <TableCell>
                      {row.email ?? (
                        <details>
                          <summary>Record reference</summary>
                          {row.id}
                        </details>
                      )}
                    </TableCell>
                    {resource === 'users' && (
                      <>
                        <TableCell>
                          {displayRoles(row.roles ?? [])} / {row.disabled ? 'Disabled' : 'Enabled'}
                        </TableCell>
                        <TableCell>
                          {row.batchId
                            ? `${batches.find((b) => b.id === row.batchId)?.name ?? row.batchId} / ${row.registrationNumber ?? 'No registration'}`
                            : ''}
                          {row.laboratoryIds
                            ?.map((id) => labs.find((l) => l.id === id)?.name ?? id)
                            .join(', ') || ' No laboratory assignments'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            disabled={saving || row.id === session.user.id}
                            onClick={() => edit(row)}
                            aria-label={`Edit ${row.displayName ?? row.email ?? row.id}`}
                          >
                            {row.id === session.user.id ? 'Self-change unavailable' : 'Edit'}
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {!filteredRows.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      No matching records. Try another name or email.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="p-6">
            {error
              ? 'Records unavailable. Resolve the error before continuing.'
              : 'No records yet.'}
          </p>
        )}
      </section>
      <ReviewSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!saving) setFormOpen(open);
        }}
        title={editing ? 'Edit user access' : 'Create record'}
        description="Review the details before saving changes."
      >
        <h2 ref={titleRef} tabIndex={-1} id="form-title">
          {editing
            ? 'Edit user grants'
            : `Create ${resource === 'users' ? 'user' : resource === 'batches' ? 'academic batch' : 'laboratory'}`}
        </h2>
        {editing && (
          <p className="my-4">
            {editing.displayName} / {editing.email}. Identity fields are read only. Saving revokes
            this user’s existing sessions.
          </p>
        )}
        {error && <ErrorNotice message={error} />}
        <form
          key={editing?.id ?? 'create'}
          onSubmit={save}
          aria-labelledby="form-title"
          aria-busy={saving}
          className="admin-record-form grid gap-4 mt-4"
        >
          <fieldset disabled={saving || loading || denied} className="grid gap-4">
            {resource === 'users' ? (
              <>
                {!editing && (
                  <>
                    <div>
                      <label htmlFor="displayName">Display name</label>
                      <Input id="displayName" name="displayName" required maxLength={120} />
                    </div>
                    <div>
                      <label htmlFor="user-email">Email</label>
                      <Input
                        id="user-email"
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password">Initial password</label>
                      <Input
                        id="new-password"
                        name="password"
                        type="password"
                        required
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        aria-describedby="password-help"
                      />
                      <p id="password-help" className="muted">
                        12–128 characters. Cleared after each submission.
                      </p>
                    </div>
                  </>
                )}
                <fieldset>
                  <legend className="font-semibold">Assigned roles</legend>
                  {(Object.keys(roleLabels) as Role[]).map((role) => (
                    <label key={role} className="flex items-center gap-3 min-h-11">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={(e) =>
                          setRoles((old) =>
                            e.target.checked ? [...old, role] : old.filter((r) => r !== role)
                          )
                        }
                      />
                      {roleLabels[role]}
                    </label>
                  ))}
                </fieldset>
                {!editing && student && (
                  <>
                    <div>
                      <label htmlFor="batch">Academic batch</label>
                      <select id="batch" name="batchId" required defaultValue="">
                        <option value="">Select academic batch</option>
                        {batches.map((batch) => (
                          <option value={batch.id} key={batch.id}>
                            {batch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="registration">Registration number</label>
                      <Input id="registration" name="registrationNumber" required maxLength={100} />
                    </div>
                  </>
                )}
                <fieldset>
                  <legend className="font-semibold">Laboratory assignments</legend>
                  <p className="muted">
                    {staff
                      ? 'Select the staff laboratories.'
                      : 'Existing assignments are preserved unless explicitly changed.'}
                  </p>
                  {labs.map((lab) => (
                    <label key={lab.id} className="flex items-center gap-3 min-h-11">
                      <input
                        type="checkbox"
                        checked={labIds.includes(lab.id)}
                        onChange={(e) =>
                          setLabIds((old) =>
                            e.target.checked ? [...old, lab.id] : old.filter((id) => id !== lab.id)
                          )
                        }
                      />
                      {lab.name}
                    </label>
                  ))}
                  {labIds
                    .filter((id) => !labs.some((l) => l.id === id))
                    .map((id) => (
                      <label key={id} className="flex items-center gap-3 min-h-11">
                        <input
                          type="checkbox"
                          checked
                          onChange={() => setLabIds((old) => old.filter((value) => value !== id))}
                        />
                        Existing assignment {id} (not in loaded list)
                      </label>
                    ))}
                  {!labs.length && <p>No laboratories available in the loaded list.</p>}
                </fieldset>
                {editing && (
                  <label className="flex items-center gap-3 min-h-11" htmlFor="disabled">
                    <input
                      id="disabled"
                      name="disabled"
                      type="checkbox"
                      defaultChecked={editing.disabled ?? false}
                    />
                    Disable account
                  </label>
                )}
              </>
            ) : (
              <div>
                <label htmlFor="name">Name</label>
                <Input id="name" name="name" required maxLength={120} />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={resource === 'users' && !roles.length}>
                {saving ? 'Saving...' : editing ? 'Save grants' : 'Create record'}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(false);
                    setRoles([]);
                    setLabIds([]);
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </ReviewSheet>
    </>
  );
}
