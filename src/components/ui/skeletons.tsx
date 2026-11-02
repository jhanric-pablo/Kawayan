import React from 'react';

/** Rows of soft blocks for a loading list (tickets, messages, payments). */
export const ListSkeleton: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className = 'grid gap-2 p-4' }) => (
  <div className={className} role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3">
        <span className="kw-skel h-8 w-8 shrink-0 rounded-full" />
        <span className="grid flex-1 gap-1.5">
          <span className="kw-skel h-3 w-3/5 rounded" />
          <span className="kw-skel h-2.5 w-2/5 rounded" />
        </span>
      </div>
    ))}
  </div>
);

/** A chat thread loading: alternating bubbles. */
export const ThreadSkeleton: React.FC = () => (
  <div className="grid h-full content-start gap-3 p-5" role="status" aria-label="Opening the conversation">
    <span className="kw-skel h-12 w-3/5 rounded-xl" />
    <span className="kw-skel ml-auto h-10 w-1/2 rounded-xl" />
    <span className="kw-skel h-16 w-2/3 rounded-xl" />
  </div>
);
