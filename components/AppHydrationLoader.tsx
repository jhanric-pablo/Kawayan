import React from 'react';

/** Minimal placeholder shown while session/view state hydrates on reload. */
const AppHydrationLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 transition-all duration-300">
    <div
      className="w-12 h-12 rounded-full animate-spin"
      style={{
        border: '2px solid var(--border-strong)',
        borderTopColor: 'var(--primary)',
      }}
      aria-hidden
    />
    <p className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>
      Waking Kawayan…
    </p>
    <p className="text-xs tracking-wide" style={{ color: 'var(--fg-muted)' }}>
      Restoring your workspace
    </p>
    <div className="w-full max-w-lg grid grid-cols-7 gap-2 mt-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-[var(--r-md)] animate-pulse transition-all duration-300"
          style={{
            background: 'var(--kw-green-pale)',
            animationDelay: `${(i % 7) * 60}ms`,
          }}
        />
      ))}
    </div>
  </div>
);

export default AppHydrationLoader;
