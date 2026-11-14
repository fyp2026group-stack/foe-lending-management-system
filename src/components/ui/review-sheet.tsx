'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useCallback,
  useState,
  useRef,
  type RefObject,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from './alert-dialog';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
const ReviewLock = createContext<((id: string, locked: boolean) => void) | null>(null);
const WorkspaceLocked = createContext(false);
export function ReviewWorkspace({ children }: { children: ReactNode }) {
  const [locks, setLocks] = useState<Set<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);
  const update = useCallback(
    (id: string, locked: boolean) =>
      setLocks((current) => {
        if (current.has(id) === locked) return current;
        const next = new Set(current);
        if (locked) next.add(id);
        else next.delete(id);
        return next;
      }),
    []
  );
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('.record-grid').forEach((element) => {
      element.inert = locks.size > 0;
    });
  }, [locks]);
  return (
    <ReviewLock.Provider value={update}>
      <WorkspaceLocked.Provider value={locks.size > 0}>
        <div ref={ref} className="review-workspace">
          {children}
        </div>
      </WorkspaceLocked.Provider>
    </ReviewLock.Provider>
  );
}
export function ReviewPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const locked = useContext(WorkspaceLocked);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, title]);
  if (!open) return null;
  return (
    <section className="review-panel" aria-labelledby={id}>
      <header>
        <div>
          <h2 id={id} ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p>{description}</p>
        </div>
        <Button type="button" variant="ghost" disabled={locked} onClick={() => onOpenChange(false)}>
          Close review
        </Button>
      </header>
      <div className="review-panel-body">{children}</div>
      {locked && (
        <p role="status" className="review-pending">
          Keep this review open until the operation result is resolved.
        </p>
      )}
    </section>
  );
}
export function useReviewLock(busy: boolean, pending: RefObject<unknown>) {
  const update = useContext(ReviewLock);
  const id = useId();
  useEffect(() => {
    update?.(id, busy || pending.current !== null);
    return () => update?.(id, false);
  }, [busy, pending, update, id]);
}
export function ReviewSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = 'default',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'equipment';
}) {
  const [locks, setLocks] = useState<Set<string>>(() => new Set());
  const update = useCallback(
    (id: string, locked: boolean) =>
      setLocks((current) => {
        const next = new Set(current);
        if (locked) next.add(id);
        else next.delete(id);
        return next;
      }),
    []
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!locks.size) onOpenChange(value);
      }}
    >
      <DialogContent
        className={variant === 'equipment' ? 'review-sheet equipment-detail-dialog' : 'review-sheet'}
        onEscapeKeyDown={(event) => { if (locks.size) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (locks.size) event.preventDefault(); }}
      >
        <DialogHeader>
          {variant === 'equipment' && <p className="dialog-eyebrow">INVENTORY / EQUIPMENT DETAILS</p>}
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="review-sheet-body" tabIndex={0}>
          <ReviewLock.Provider value={update}>{children}</ReviewLock.Provider>
        </div>
        {footer && (
          <footer className="review-sheet-footer">
            {footer}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Consequential student actions retain the original command while their result is uncertain. */
export function ReviewAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [locks, setLocks] = useState<Set<string>>(() => new Set());
  const update = useCallback(
    (id: string, locked: boolean) =>
      setLocks((current) => {
        if (current.has(id) === locked) return current;
        const next = new Set(current);
        if (locked) next.add(id);
        else next.delete(id);
        return next;
      }),
    []
  );
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!locks.size) onOpenChange(value);
      }}
    >
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ReviewLock.Provider value={update}>{children}</ReviewLock.Provider>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locks.size > 0}>Keep request</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
