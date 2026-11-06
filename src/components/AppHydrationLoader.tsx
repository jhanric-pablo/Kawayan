import React from 'react';

// Three stalks (x, joints, leaf side). The ground sits at y = 86; each joint is 15 units tall.
const STALKS = [
  { x: 36, joints: 3, leaf: 'left' },
  { x: 56, joints: 5, leaf: 'right' },
  { x: 76, joints: 4, leaf: 'right' },
] as const;
const GROUND = 86;
const JOINT = 15;

/**
 * Full-page loader: a small bamboo grove grows joint by joint, the leaves open, then the stalks
 * sway until the page is ready. Shown while the session hydrates and while a lazy screen downloads.
 * Under reduced motion it shows the grown grove, still.
 */
const AppHydrationLoader: React.FC<{ sub?: string }> = ({ sub = 'Restoring your workspace' }) => (
  <div className="kw-loader" role="status" aria-live="polite">
    <svg className="kw-loader__grove" viewBox="0 0 112 96" aria-hidden>
      <line className="kw-loader__ground" x1="16" y1={GROUND + 1} x2="96" y2={GROUND + 1} />
      {STALKS.map((s, si) => {
        const top = GROUND - s.joints * JOINT + 2;
        const grown = si * 0.15 + s.joints * 0.12;
        return (
          <g key={s.x} className="kw-loader__stalk" style={{ animationDelay: `${grown + 0.4 + si * 0.5}s` }}>
            {Array.from({ length: s.joints }).map((_, i) => (
              <rect
                key={i}
                className="kw-loader__seg"
                x={s.x}
                y={GROUND - (i + 1) * JOINT + 2}
                width="8"
                height="13"
                rx="2.5"
                style={{ animationDelay: `${si * 0.15 + i * 0.12}s`, fillOpacity: si === 1 ? 1 : 0.7 }}
              />
            ))}
            <path
              className={`kw-loader__leaf kw-loader__leaf--${s.leaf}`}
              d={s.leaf === 'right'
                ? `M${s.x + 7} ${top + 3}c6-1 11-5 13-12c-7 0-12 4-13 9z`
                : `M${s.x + 1} ${top + 3}c-6-1-11-5-13-12c7 0 12 4 13 9z`}
              style={{ animationDelay: `${grown + 0.05}s` }}
            />
          </g>
        );
      })}
    </svg>
    <div className="text-center">
      <p className="text-base font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>Waking Kawayan…</p>
      <p className="mono mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>{sub}</p>
    </div>
  </div>
);

export default AppHydrationLoader;
