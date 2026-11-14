export function createConfirmationGate() {
  let action: (() => Promise<void>) | null = null;
  let restore: (() => void) | null = null;
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    get staged() {
      return action !== null;
    },
    stage(next: () => Promise<void>, returnFocus: () => void) {
      if (pending || action) return false;
      action = next;
      restore = returnFocus;
      return true;
    },
    cancel() {
      if (pending) return false;
      action = null;
      return true;
    },
    async confirm() {
      if (pending || !action) return false;
      pending = true;
      try {
        await action();
        action = null;
        return true;
      } finally {
        pending = false;
      }
    },
    restoreFocus() {
      restore?.();
      restore = null;
    },
  };
}
