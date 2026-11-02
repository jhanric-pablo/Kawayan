import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A callback whose identity never changes but always calls the latest version, so memoised
 * children (calendar day cells, list rows) don't re-render just because a parent re-rendered.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
