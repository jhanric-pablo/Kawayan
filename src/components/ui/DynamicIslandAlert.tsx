import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

export type IslandTone = 'success' | 'error' | 'info';
export interface IslandAction {
  label: string;
  onClick: () => void;
}

// Theme colours, so the toast is light in light mode and dark in dark mode.
const DOT: Record<IslandTone, string> = {
  success: 'bg-(--primary)',
  info: 'bg-(--primary)',
  error: 'bg-(--danger)',
};

/**
 * The pill for every toast in the app, in the current theme's colours. A thin bar runs down while it's on screen, so you can
 * see how long "Undo" is still there; pointing at it or tabbing into it pauses the countdown.
 */
const DynamicIslandAlert: React.FC<{
  message: string;
  tone: IslandTone;
  duration: number;
  action?: IslandAction;
  onDismiss: () => void;
}> = ({ message, tone, duration, action, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const left = useRef(duration);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const t = setTimeout(onDismiss, left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
    // onDismiss is a fresh closure every render but always dismisses this toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-[1.4rem] border border-(--border-strong) bg-(--card) py-2 pl-4 pr-1.5 text-ui font-medium text-(--fg) shadow-xl animate-island-in motion-reduce:animate-none"
    >
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', DOT[tone])} aria-hidden />
      <span className="min-w-0 flex-1 py-0.5 leading-snug">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-(--primary) transition-colors hover:bg-(--bg-alt)"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-(--fg-muted) transition-colors hover:bg-(--bg-alt) hover:text-(--fg)"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span className="absolute inset-x-4 bottom-1 h-0.5 overflow-hidden rounded-full bg-(--border) motion-reduce:hidden" aria-hidden>
        <span
          className={clsx('block h-full origin-left animate-toast-drain rounded-full', DOT[tone])}
          style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      </span>
    </div>
  );
};

export default DynamicIslandAlert;
