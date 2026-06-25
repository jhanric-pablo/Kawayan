import React from 'react';

/** Minimal Wabi-Sabi placeholder shown while session/view state hydrates on reload. */
const AppHydrationLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 transition-all duration-300">
    <div
      className="w-12 h-12 rounded-full border-2 border-[#0052FF]/20 border-t-[#0052FF] dark:border-[#4D7CFF]/20 dark:border-t-[#4D7CFF] animate-spin"
      aria-hidden
    />
    <p className="font-display text-lg font-semibold text-[#0F172A]/80 dark:text-white/80">
      Waking Kawayan…
    </p>
    <p className="text-xs text-[#64748B] dark:text-[#4D7CFF]/80 tracking-wide">
      Restoring your workspace
    </p>
    <div className="w-full max-w-lg grid grid-cols-7 gap-2 mt-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-xl bg-[#0052FF]/8 dark:bg-[#4D7CFF]/10 animate-pulse transition-all duration-300"
          style={{ animationDelay: `${(i % 7) * 60}ms` }}
        />
      ))}
    </div>
  </div>
);

export default AppHydrationLoader;
