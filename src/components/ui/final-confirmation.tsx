'use client';
import { useRef, useState, type ReactNode, type FormEvent } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './alert-dialog';
import { useReviewLock } from './review-sheet';
import { createConfirmationGate } from './confirmation-model';
import { Button } from './button';

type Summary = { label: string; value: string }[];
/** Capture the values being reviewed, including selected option labels, rather than live editable controls. */
export function formSummary(form: HTMLFormElement): Summary {
  const rows: Summary = [];
  form.querySelectorAll('dl').forEach((dl) =>
    dl.querySelectorAll('div').forEach((row) => {
      const label = row.querySelector('dt')?.textContent;
      const value = row.querySelector('dd')?.textContent;
      if (label && value) rows.push({ label, value });
    })
  );
  Array.from(form.elements).forEach((element) => {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) ||
      !element.name ||
      element.type === 'checkbox' ||
      element.type === 'file'
    )
      return;
    const label = element.labels?.[0]?.textContent?.trim() || element.name;
    const value =
      element instanceof HTMLSelectElement
        ? Array.from(element.selectedOptions)
            .map((o) => o.text)
            .join(', ')
        : element.value;
    if (value) rows.push({ label, value: element.name === 'remarks' ? value.trim() : value });
  });
  return rows;
}
function useFinalConfirmation(title: string) {
  const gate = useRef(createConfirmationGate());
  const [review, setReview] = useState<{ summary: Summary; context?: ReactNode } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef<unknown>(null);
  useReviewLock(Boolean(review) || busy, lock);
  function stage(
    action: () => Promise<void>,
    summary: Summary,
    origin: HTMLElement | null,
    context?: ReactNode
  ) {
    if (
      gate.current.stage(action, () => {
        if (origin?.isConnected) origin.focus();
      })
    ) {
      setError('');
      setReview({ summary, context });
    }
  }
  async function confirm() {
    if (gate.current.pending) return;
    setBusy(true);
    setError('');
    try {
      if (await gate.current.confirm()) setReview(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to confirm operation.');
    } finally {
      setBusy(false);
    }
  }
  const dialog = (
    <AlertDialog
      open={Boolean(review)}
      onOpenChange={(open) => {
        if (!open && gate.current.cancel()) setReview(null);
      }}
    >
      <AlertDialogContent
        className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (gate.current.pending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          gate.current.restoreFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm: {title}</AlertDialogTitle>
          <AlertDialogDescription>
            Review these exact details. Confirm records the operation; cancel returns to the form
            without making a change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {review?.context}
        <dl className="review-facts">
          {review?.summary.map((row, index) => (
            <div key={index}>
              <dt>{row.label}</dt>
              <dd className="break-words whitespace-pre-wrap">{row.value}</dd>
            </div>
          ))}
        </dl>
        {error && <p role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              if (gate.current.cancel()) setReview(null);
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {busy ? 'Recording operation...' : 'Confirm ' + title}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { stage, dialog, busy };
}
export function ConfirmedForm({
  title,
  onConfirmed,
  children,
  className,
  context,
  enabled = true,
}: {
  enabled?: boolean;
  title: string;
  onConfirmed: (data: FormData, form: HTMLFormElement) => Promise<void>;
  children: ReactNode;
  className?: string;
  context?: ReactNode;
}) {
  const confirmation = useFinalConfirmation(title);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    if (!enabled) {
      void onConfirmed(values, form);
      return;
    }
    const origin = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    confirmation.stage(
      () => onConfirmed(values, form),
      formSummary(form),
      origin ?? form.querySelector('button[type=submit]'),
      context
    );
  }
  return (
    <>
      <form onSubmit={submit} className={className}>
        {children}
      </form>
      {confirmation.dialog}
    </>
  );
}
export function ConfirmedAction({
  title,
  onConfirmed,
  children,
  summary,
  context,
  disabled = false,
}: {
  title: string;
  onConfirmed: () => Promise<void>;
  children: ReactNode;
  summary: Summary;
  context?: ReactNode;
  disabled?: boolean;
}) {
  const confirmation = useFinalConfirmation(title);
  return (
    <>
      <Button
        type="button"
        disabled={disabled || confirmation.busy}
        onClick={(event) => confirmation.stage(onConfirmed, summary, event.currentTarget, context)}
      >
        {children}
      </Button>
      {confirmation.dialog}
    </>
  );
}
