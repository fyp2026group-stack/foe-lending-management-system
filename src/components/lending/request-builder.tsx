'use client';
import { StudentEmptyState } from './student-empty-state';
import { StudentSelect } from './student-controls';
import { useState, useRef, type FormEvent } from 'react';
import { ApiError } from '@/components/identity/api';
import { lendingWrite, type BorrowDraft } from './api';
import { ErrorNotice } from '@/components/identity/session';
import type { Session } from '@/components/identity/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentClock } from './student-clock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLendingChoices } from './shared';
import type { Lecturer, LendingSource } from './api';
import { CommandReplay, draftSavePayload, draftSubmitPayload } from './lifecycle-model';
import { basketKey, readSelection, isStudent } from './student-model';
import { eligibleLecturers, quantityLimit } from './request-options';

const selectClass = 'request-composer-select w-full min-w-0';
type DraftLine = {
  key: number;
  itemId: string;
  labId: string;
  locationId: string;
  quantity: number;
};
const blankLine = (key: number): DraftLine => ({
  key,
  itemId: '',
  labId: '',
  locationId: '',
  quantity: 1,
});
const requiresLecturer = (source: LendingSource) =>
  source.policy === 'LECTURER' || source.policy === 'BOTH';

export function RequestBuilder({
  session,
  revision,
  refresh,
  draft,
}: {
  session: Session;
  revision: number;
  refresh: () => void;
  draft?: BorrowDraft;
}) {
  const student = isStudent(session.user.roles);
  const now = useStudentClock(revision);
  const Container = Card;
  const Header = CardHeader;
  const Title = CardTitle;
  const Content = CardContent;
  const Footer = CardFooter;
  const Purpose = Textarea;
  const SelectControl = StudentSelect;
  const sources = useLendingChoices<LendingSource>('sources', revision);
  const lecturers = useLendingChoices<Lecturer>('lecturers', revision);
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (draft) return draft.payload.lines.map((line, key) => ({ ...line, key }));
    try {
      const carried = readSelection(sessionStorage.getItem(basketKey(session.user.id)));
      if (carried.length) return carried.map((line, key) => ({ ...line, key }));
    } catch {}
    return [blankLine(0)];
  });
  const [nextKey, setNextKey] = useState(() => Math.max(lines.length, 1));
  const [lecturerId, setLecturerId] = useState(draft?.payload.lecturerId ?? '');
  const [saved, setSaved] = useState(draft);
  const [purpose, setPurpose] = useState(draft?.payload.purpose ?? '');
  const local = (value?: string) =>
    value
      ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
  const [collectAt, setCollectAt] = useState(local(draft?.payload.collectAt));
  const [returnAt, setReturnAt] = useState(local(draft?.payload.returnAt));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertainPath, setUncertainPath] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(new CommandReplay());
  async function act(path: string, body: Record<string, unknown>) {
    const command = pending.current.prepare(path, body);
    try {
      const result = await lendingWrite<{ id: string; version: number }>(
        path,
        command,
        session.csrfToken
      );
      pending.current.resolve();
      setUncertainPath('');
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) {
        pending.current.resolve();
        setUncertainPath('');
      } else setUncertainPath(path);
      throw error;
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const payload = {
        purpose,
        ...(collectAt ? { collectAt: new Date(collectAt).toISOString() } : {}),
        ...(returnAt ? { returnAt: new Date(returnAt).toISOString() } : {}),
        ...(chosenLecturer ? { lecturerId: chosenLecturer } : {}),
        lines: lines.map(({ itemId, labId, locationId, quantity }) => ({
          itemId,
          labId,
          locationId,
          quantity,
        })),
      };
      const result = await act('drafts', draftSavePayload(payload, saved));
      try {
        sessionStorage.removeItem(basketKey(session.user.id));
      } catch {}
      setSaved({ ...result, payload, cancelled: false, updatedAt: new Date().toISOString() });
      setReview(true);
      setMessage('Draft saved. Review the saved details before submitting.');
      refresh();
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'The draft changed. Reopen it from My requests before retrying.'
          : error instanceof Error
            ? error.message
            : 'Outcome unknown. Retry the same action.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!saved) return;
    setBusy(true);
    try {
      await act('submit', draftSubmitPayload(saved));
      setReview(false);
      setSaved(undefined);
      setLines([blankLine(nextKey)]);
      setNextKey(nextKey + 1);
      setPurpose('');
      setMessage('Request submitted. View its progress in My requests.');
      refresh();
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'Saved version is stale. Reopen the draft and review again.'
          : error instanceof Error
            ? error.message
            : 'Outcome unknown. Retry submission with the same details.'
      );
    } finally {
      setBusy(false);
    }
  }
  const choices = sources.data?.items ?? [];
  const items = Array.from(new Map(choices.map((source) => [source.itemId, source])).values());
  const sourceFor = (line: DraftLine) =>
    choices.find(
      (source) =>
        source.itemId === line.itemId &&
        source.labId === line.labId &&
        source.locationId === line.locationId
    );
  const selectedSources = lines.map(sourceFor);
  const needsLecturer = selectedSources.some((source) => source && requiresLecturer(source));
  const labsChosen = lines.every((line) => Boolean(line.labId));
  const eligible = labsChosen
    ? eligibleLecturers(
        lecturers.data?.items ?? [],
        lines.map((line) => line.labId),
        session.user.id
      )
    : [];
  const chosenLecturer = eligible.some((lecturer) => lecturer.id === lecturerId) ? lecturerId : '';
  function update(key: number, value: Partial<DraftLine>) {
    setReview(false);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...value } : line)));
  }

  if (sources.error || lecturers.error)
    return (
      <section className="records p-4">
        <h2>Borrowing choices unavailable</h2>
        {sources.error && <ErrorNotice message={sources.error} />}
        {lecturers.error && <ErrorNotice message={lecturers.error} />}
        <p>Use Refresh records to load current borrowing sources and lecturer eligibility again.</p>
      </section>
    );
  if (!sources.data || !lecturers.data)
    return (
      <div role="status">
        <p>Loading borrowing sources and lecturer eligibility...</p>
        <Skeleton className="h-32 w-full" />
      </div>
    );

  return (
    <Container className={student ? 'cp2-builder student-builder request-composer' : 'cp2-builder request-composer'}>
      <Header>
        <div className="request-composer-heading">
          <div>
            <p className="request-composer-eyebrow">EQUIPMENT LENDING</p>
            <Title>{draft?.predecessorId ? 'Correct an equipment request' : 'New equipment request'}</Title>
            <CardDescription>
              Choose equipment, set the collection and return dates, and review before submitting.
            </CardDescription>
          </div>
          <span className="request-composer-count">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
        </div>
      </Header>
      <Content>
        {!choices.length &&
          (student ? (
            <StudentEmptyState kind="equipment" />
          ) : (
            <p role="status">
              No current borrowing sources are available. You can still save an incomplete draft and
              add equipment when sources are available.
            </p>
          ))}
        <ol className="request-composer-steps" aria-label="Request progress">
          <li className={review ? 'is-complete' : 'is-active'}><span>1</span> Equipment & dates</li>
          <li className={review ? 'is-active' : ''}><span>2</span> Review saved draft</li>
          <li><span>3</span> Submit request</li>
        </ol>
        <p className="request-composer-hint">You can save a draft without submitting it. Stock is confirmed by the server when the request progresses.</p>
        {draft?.predecessorId && (
          <p>
            Correction of {draft.predecessorId}. Original decisions and quantities remain in
            history.
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {uncertainPath === 'submit' && (
          <Button disabled={busy} onClick={submit}>
            Recover submission result
          </Button>
        )}
        <form noValidate onSubmit={save} onChange={() => setReview(false)}>
          <fieldset disabled={busy || Boolean(uncertainPath)} className="grid gap-4">
            <div className="request-details">
              <h3>Request details <small>Purpose and expected borrowing period</small></h3>
              <label>
                {student ? 'Academic purpose' : 'Borrowing purpose'}
                <Purpose
                  maxLength={1000}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Explain how the selected equipment will be used"
                />
              </label>
              <label>
                Collection date and time
                <Input
                  type="datetime-local"
                  value={collectAt}
                  onChange={(e) => setCollectAt(e.target.value)}
                />
              </label>
              <label>
                Expected Return Date
                <Input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                />
              </label>
            </div>
            {lines.map((line, index) => {
              const labs = Array.from(
                new Map(
                  choices
                    .filter((source) => source.itemId === line.itemId)
                    .map((source) => [source.labId, source])
                ).values()
              );
              const locations = choices.filter(
                (source) => source.itemId === line.itemId && source.labId === line.labId
              );
              const source = sourceFor(line);
              return (
                <fieldset key={line.key} className="request-line">
                  <legend>Equipment {index + 1}</legend>
                  <label>
                    Equipment
                    <SelectControl
                      className={selectClass}
                      value={line.itemId}
                      onChange={(event) =>
                        update(line.key, {
                          itemId: event.target.value,
                          labId: '',
                          locationId: '',
                          quantity: 1,
                        })
                      }
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.item} / {item.kind} / {item.uom}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  <label>
                    Laboratory
                    <SelectControl
                      className={selectClass}
                      disabled={!line.itemId}
                      value={line.labId}
                      onChange={(event) =>
                        update(line.key, { labId: event.target.value, locationId: '', quantity: 1 })
                      }
                    >
                      <option value="">Select laboratory</option>
                      {labs.map((lab) => (
                        <option key={lab.labId} value={lab.labId}>
                          {lab.lab}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  <label>
                    Collection location
                    <SelectControl
                      className={selectClass}
                      disabled={!line.labId}
                      value={line.locationId}
                      onChange={(event) =>
                        update(line.key, { locationId: event.target.value, quantity: 1 })
                      }
                    >
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.locationId} value={location.locationId}>
                          {location.location} / {location.availableQuantity} {location.uom}{' '}
                          available
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  {source && (
                    <p id={'source-' + line.key}>
                      {source.lab} / {source.location}: {source.availableQuantity} {source.uom}{' '}
                      available. Approval: {source.policy}. Request limit: {quantityLimit(source)}{' '}
                      {source.uom}.
                    </p>
                  )}
                  <label>
                    Quantity {source ? `(${source.uom})` : ''}
                    <Input
                      type="number"
                      min={1}
                      max={source ? quantityLimit(source) : 1}
                      step={1}
                      disabled={!source}
                      aria-describedby={source ? 'source-' + line.key : undefined}
                      value={line.quantity}
                      onChange={(event) =>
                        update(line.key, { quantity: Number(event.target.value) })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lines.length === 1}
                    onClick={() => {
                      setReview(false);
                      setLines((current) => current.filter((row) => row.key !== line.key));
                    }}
                  >
                    Remove equipment
                  </Button>
                </fieldset>
              );
            })}
            <Button
              type="button"
              variant="outline"
              disabled={lines.length >= 20}
              onClick={() => {
                setReview(false);
                setLines((current) => [...current, blankLine(nextKey)]);
                setNextKey((key) => key + 1);
              }}
            >
              Add another item ({lines.length}/20)
            </Button>
            {needsLecturer ? (
              <>
                <label>
                  Eligible lecturer (required)
                  <SelectControl
                    name="lecturerId"
                    className={selectClass}
                    value={chosenLecturer}
                    onChange={(event) => setLecturerId(event.target.value)}
                    aria-describedby="lecturer-help"
                  >
                    <option value="">Select lecturer</option>
                    {eligible.map((lecturer) => (
                      <option key={lecturer.id} value={lecturer.id}>
                        {lecturer.displayName}
                      </option>
                    ))}
                  </SelectControl>
                </label>
                <p id="lecturer-help" role="status">
                  {!labsChosen
                    ? 'Choose a laboratory for every item to see eligible lecturers.'
                    : eligible.length
                      ? 'Only lecturers assigned to every requested laboratory are listed.'
                      : 'No lecturer is eligible for every requested laboratory. Change the selected laboratories or submit separate requests.'}
                </p>
              </>
            ) : (
              <p>No lecturer selection is required by the selected sources.</p>
            )}
            <p className="muted">
              Availability is current stock, not a future booking guarantee. The server rechecks
              stock, approval policy and lecturer eligibility. Consumables do not require a return.
            </p>
          </fieldset>
          <Footer>
            <Button disabled={busy || uncertainPath === 'submit'} type="submit">
              {busy ? 'Saving...' : 'Save draft and review'}
            </Button>
          </Footer>
        </form>
        {review && saved && (
          <section className="request-composer-review" aria-label="Review saved draft">
            <div className="request-composer-review-header">
              <div>
                <h3>Review your request</h3>
                <p>Confirm these details before submitting. A saved draft does not reserve equipment.</p>
              </div>
            </div>
            {(!purpose.trim() ||
              !collectAt ||
              !returnAt ||
              new Date(returnAt).getTime() <= now ||
              (needsLecturer && !chosenLecturer) ||
              lines.some((line) => !sourceFor(line))) && (
              <Alert>
                <AlertTitle>Complete the saved request before submitting</AlertTitle>
                <AlertDescription>
                  <ul>
                    {!purpose.trim() && <li>Add an academic purpose.</li>}
                    {(!collectAt || !returnAt) && (
                      <li>Choose collection and expected return dates.</li>
                    )}
                    {returnAt && new Date(returnAt).getTime() <= now && (
                      <li>Expected return must be in the future.</li>
                    )}
                    {needsLecturer && !chosenLecturer && (
                      <li>Select an eligible lecturer for the requested laboratories.</li>
                    )}
                    {lines.some((line) => !sourceFor(line)) && (
                      <li>
                        Choose a currently authorized item, laboratory and location for every line.
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <p>
              Submission requires a purpose, distinct current sources, quantities within each policy
              limit, an eligible lecturer when required, and a future return after collection.
              Correct any missing details and save again.
            </p>
            <dl className="request-composer-summary">
              <div><dt>Purpose</dt><dd>{purpose || 'Not specified'}</dd></div>
              <div><dt>Equipment</dt><dd>{lines.length} {lines.length === 1 ? 'item' : 'items'} selected</dd></div>
              <div><dt>Collection</dt><dd>{collectAt ? new Date(collectAt).toLocaleString() : 'Not selected'}</dd></div>
              <div><dt>Expected return</dt><dd>{returnAt ? new Date(returnAt).toLocaleString() : 'Not selected'}</dd></div>
              {needsLecturer && <div><dt>Academic approval</dt><dd>{eligible.find((lecturer) => lecturer.id === chosenLecturer)?.displayName ?? 'Select an eligible lecturer'}</dd></div>}
            </dl>
            <p>
              Submitting sends this saved version for current policy and source validation. Approval
              can reserve stock; physical handover happens separately.
            </p>
            <Button
              disabled={
                busy ||
                !purpose.trim() ||
                !collectAt ||
                !returnAt ||
                lines.some(
                  (line) =>
                    !sourceFor(line) ||
                    !Number.isInteger(line.quantity) ||
                    line.quantity < 1 ||
                    line.quantity > quantityLimit(sourceFor(line)!)
                ) ||
                new Date(returnAt) <= new Date(collectAt) ||
                new Date(returnAt).getTime() <= now ||
                new Set(lines.map((line) => [line.itemId, line.labId, line.locationId].join(':')))
                  .size !== lines.length ||
                (needsLecturer && !chosenLecturer)
              }
              onClick={submit}
            >
              Confirm and submit saved draft
            </Button>
          </section>
        )}
      </Content>
    </Container>
  );
}
