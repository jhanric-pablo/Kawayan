import React from 'react';

/**
 * Suspense fallback while a lazily loaded screen downloads: the shape of a typical page (title,
 * four stat cards, a wide card and a side card) in soft skeleton blocks, so nothing jumps when the
 * real page arrives. Opacity pulse only; still under reduced motion.
 */
const PageSkeleton: React.FC<{ variant?: 'page' | 'console' }> = ({ variant = 'page' }) => (
  <div className={variant === 'console' ? 'p-4 md:p-6' : 'mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8'} role="status" aria-live="polite" aria-label="Loading">
    <div className="kw-skel h-7 w-48 rounded-md" />
    <div className="kw-skel mt-2 h-4 w-80 max-w-full rounded-md" />
    <div className="kw-stats mt-6">
      {[0, 1, 2, 3].map((i) => <div key={i} className="kw-skel h-[104px] rounded-xl" />)}
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div className="kw-skel h-72 rounded-xl" />
      <div className="kw-skel h-72 rounded-xl" />
    </div>
  </div>
);

export default PageSkeleton;
