import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

/**
 * A bar for AI work that takes a while: `done` of `total` parts are finished, and while `running`
 * the part in progress creeps forward (fast at first, then slower, never past 90% of its share),
 * so the bar keeps moving instead of sitting still between parts.
 */
export const ProgressBar: React.FC<{
  done: number;
  total: number;
  running: boolean;
  /** About how long one part takes; sets the creep speed. */
  partMs?: number;
  label?: string;
  className?: string;
}> = ({ done, total, running, partMs = 12000, label = 'Progress', className }) => {
  const [creep, setCreep] = useState(0);
  useEffect(() => {
    setCreep(0);
    if (!running || done >= total) return;
    const start = performance.now();
    const t = window.setInterval(() => setCreep(0.9 * (1 - Math.exp(-(performance.now() - start) / (partMs / 2)))), 200);
    return () => window.clearInterval(t);
  }, [done, total, running, partMs]);

  const pct = total > 0 ? Math.min(100, ((done + (running ? creep : 0)) / total) * 100) : 0;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={clsx('block h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]', className)}
    >
      <i className="block h-full rounded-full bg-(--green) transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </span>
  );
};
