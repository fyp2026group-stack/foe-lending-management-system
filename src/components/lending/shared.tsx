'use client';
import { useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { useReviewLock } from '@/components/ui/review-sheet';
import { ConfirmedForm } from '@/components/ui/final-confirmation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field as FormField, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ErrorNotice } from '@/components/identity/session';
import { ApiError, type Session } from '@/components/identity/api';
import { lendingRead, lendingWrite } from './api';
export function useLending<T>(path: string, revision: number): { data?: T; error?: string } {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
  const key = path + ':' + revision;
  useEffect(() => {
    const controller = new AbortController();
    lendingRead<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            error: error instanceof Error ? error.message : 'Unable to load records.',
          });
      });
    return () => controller.abort();
  }, [path, key]);
  return state?.key === key ? state : {};
}
export function Field({
  name,
  label,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <FormField>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        {...(type === 'number' ? { min: 1, max: 1000000, step: 1 } : { maxLength: 1000 })}
      />
    </FormField>
  );
}
export function ActionForm({
  title,
  path,
  session,
  body,
  children,
  onSaved,
  confirmationContext,
}: {
  confirmationContext?: ReactNode;
  title: string;
  path: string;
  session: Session;
  body: (data: FormData) => unknown;
  children: ReactNode;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ payload: string; id: string } | null>(null);
  useReviewLock(busy, pending);
  async function submit(data: FormData) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const value = body(data) as Record<string, unknown>;
      const payload = JSON.stringify(value);
      if (pending.current && pending.current.payload !== payload)
        throw new Error('Resolve the prior operation result before changing its input.');
      pending.current ??= { payload, id: crypto.randomUUID() };
      await lendingWrite(path, { ...value, commandId: pending.current.id }, session.csrfToken);
      pending.current = null;
      setMessage('Server recorded the operation. Reloading current records.');
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500)
        pending.current = null;
      setError(
        error instanceof ApiError && error.status === 409
          ? 'The record changed or this command conflicts with an earlier action. Refresh records, review the current version and try again.'
          : pending.current
            ? 'Outcome unknown. Retry this unchanged action to recover its result, or inspect current history before starting another operation.'
            : error instanceof Error
              ? error.message
              : 'Unable to complete the action.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="operation-form">
      <h2>{title}</h2>
      {error && <ErrorNotice message={error} />}
      <p role="status">{message}</p>
      <ConfirmedForm
        enabled={session.user.roles.includes('TECHNICAL_OFFICER')}
        title={title}
        onConfirmed={submit}
        context={confirmationContext}
      >
        <fieldset disabled={busy} className="grid gap-4 mt-4">
          {children}
          <label className="flex items-center gap-3 min-h-11">
            <input type="checkbox" required />I have reviewed the details and confirm this action.
          </label>
          <Button type="submit">{busy ? 'Checking result...' : title}</Button>
        </fieldset>
      </ConfirmedForm>
      <p className="muted mt-3">
        Current permissions are checked by the server. If the result is uncertain, check history
        before retrying.
      </p>
    </Card>
  );
}
export function Records({
  title,
  data,
  error,
  render,
}: {
  title: string;
  data?: { items: unknown[] };
  error?: string;
  render: (value: unknown, index: number) => ReactNode;
}) {
  return (
    <section className="records p-4">
      <h2>{title}</h2>
      {error && <ErrorNotice message={error} />}{' '}
      {!data && !error && <p role="status">Loading...</p>}
      {data?.items.length === 0 && <p>No records in this scope.</p>}
      {data?.items.map(render)}
    </section>
  );
}

// Resolve all source/eligibility pages before presenting a complete selector.
export function useLendingChoices<T>(
  operation: string,
  revision: number
): { data?: { items: T[] }; error?: string } {
  const [state, setState] = useState<{ key: string; data?: { items: T[] }; error?: string }>();
  const key = operation + ':' + revision;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const items: T[] = [];
      for (let offset = 0; offset <= 100000; offset += 100) {
        const page = await lendingRead<{ items: T[] }>(
          `${operation}${operation.includes('?') ? '&' : '?'}limit=100&offset=${offset}`,
          controller.signal
        );
        items.push(...page.items);
        if (page.items.length < 100) {
          if (!controller.signal.aborted) setState({ key, data: { items } });
          return;
        }
      }
      throw Error('Too many choices. Narrow your laboratory scope.');
    }
    load().catch((error) => {
      if (!controller.signal.aborted)
        setState({
          key,
          error: error instanceof Error ? error.message : 'Unable to load choices.',
        });
    });
    return () => controller.abort();
  }, [operation, key]);
  return state?.key === key ? state : {};
}
