import { RefObject, useEffect, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True while the element is at least `threshold` visible. Demos only animate while on screen. */
export function useInView(ref: RefObject<Element | null>, threshold = 0.35): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

/**
 * Steps through 0..count-1 every `ms` while `running`. Returns the index and a setter;
 * setting it by hand restarts the timer. Stands still for people who prefer reduced motion.
 */
export function useCycle(count: number, ms: number, running: boolean): [number, (i: number) => void] {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running || prefersReducedMotion()) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearTimeout(t);
  }, [index, tick, running, count, ms]);
  return [index, (i: number) => { setIndex(i); setTick((n) => n + 1); }];
}
