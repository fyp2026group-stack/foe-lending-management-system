'use client';
import { useSyncExternalStore, useCallback } from 'react';
let current = Date.now();
export const readStudentClock = () => current;
export function subscribeStudentClock(notify: () => void) {
  const update = () => {
    current = Date.now();
    notify();
  };
  update();
  const timer = setInterval(update, 30000);
  window.addEventListener('focus', update);
  return () => {
    clearInterval(timer);
    window.removeEventListener('focus', update);
  };
}
/** Stable snapshots; clock advances on a tick, window focus or resubscription after data refresh. */
export function useStudentClock(revision: unknown = 0) {
  const subscription = useCallback(
    (callback: () => void) => {
      void revision;
      return subscribeStudentClock(callback);
    },
    [revision]
  );
  return useSyncExternalStore(subscription, readStudentClock, () => 0);
}
