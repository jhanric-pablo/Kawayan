import React from 'react';
import { KawayanMark } from './KawayanLogo';

/** Minimal placeholder shown while session/view state hydrates on reload. */
const AppHydrationLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 px-6" role="status" aria-live="polite">
    <span
      className="grid h-12 w-12 place-items-center rounded-xl border bg-(--card) text-(--fg) shadow-xs"
      style={{ borderColor: 'var(--border)' }}
      aria-hidden
    >
      <KawayanMark className="h-6 w-6 animate-pulse motion-reduce:animate-none" />
    </span>
    <div className="text-center">
      <p className="text-base font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
        Waking Kawayan…
      </p>
      <p className="mono mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
        Restoring your workspace
      </p>
    </div>
    <div className="w-full max-w-lg grid grid-cols-7 gap-1 mt-2" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-md border animate-pulse motion-reduce:animate-none"
          style={{
            background: i === 3 ? 'var(--green-soft)' : 'var(--card)',
            borderColor: 'var(--border)',
            animationDelay: `${(i % 7) * 60}ms`,
          }}
        />
      ))}
    </div>
  </div>
);

export default AppHydrationLoader;
