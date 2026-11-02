import React from 'react';
import clsx from 'clsx';

/** The app icon file (kept for the favicon / manifest). In the UI use <KawayanMark />. */
export const KAWAYAN_ICON = '/brand/kawayan-icon.svg';

/** Bamboo mark: stalk in the text colour, nodes cut out in the page colour, a green leaf. */
export const KawayanMark: React.FC<{ className?: string; size?: number }> = ({ className, size }) => (
  <svg viewBox="0 0 28 28" className={clsx('kw-mark', className)} style={size ? { width: size, height: size } : undefined} aria-hidden="true">
    <rect className="kw-stalk" x="11" y="2" width="6" height="24" rx="2" />
    <rect className="kw-node" x="9" y="9" width="10" height="2" rx="1" />
    <rect className="kw-node" x="9" y="17" width="10" height="2" rx="1" />
    <path className="kw-leaf" d="M17 8c4-1 7-3 8-6-4 0-7 2-8 5z" />
  </svg>
);

interface Props {
  /** Font size in px; the mark scales with it. */
  size?: number;
  /** Light version for dark backgrounds. Dark mode switches automatically. */
  onDark?: boolean;
  className?: string;
}

/** "Kawayan" wordmark: the bamboo mark and the name in Geist. */
const KawayanLogo: React.FC<Props> = ({ size = 18, onDark = false, className }) => (
  <span className={clsx('kw-logo', onDark && 'kw-logo--on-dark', className)} style={{ fontSize: size }} role="img" aria-label="Kawayan AI">
    <KawayanMark />
    <span aria-hidden="true">Kawayan</span>
  </span>
);

export default KawayanLogo;
