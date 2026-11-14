import * as React from 'react';
const MOBILE_BREAKPOINT = 768;
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    [breakpoint]
  );
  const snapshot = React.useCallback(
    () => window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    [breakpoint]
  );
  return React.useSyncExternalStore(subscribe, snapshot, () => false);
}
