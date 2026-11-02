import React from 'react';
import clsx from 'clsx';

/** The app icon (green rounded square with the bamboo), for spots too small for the wordmark. */
export const KAWAYAN_ICON = '/brand/kawayan-icon.svg';

interface Props {
  /** Font size in px; the bamboo "I" scales with it. Keep it at 24 or more, use the icon below that. */
  size?: number;
  /** Light version for dark backgrounds. Dark mode switches automatically. */
  onDark?: boolean;
  className?: string;
}

/** "Kawayan AI" wordmark from the brand kit: Fraunces letters with a bamboo stalk as the "I". */
const KawayanLogo: React.FC<Props> = ({ size = 24, onDark = false, className }) => (
  <span className={clsx('kw-logo', onDark && 'kw-logo--on-dark', className)} style={{ fontSize: size }} role="img" aria-label="Kawayan AI">
    Kawayan A
    <svg viewBox="0 0 56 124" aria-hidden="true">
      <path className="kw-stalk" d="M8 30 L28 22 L28 54 L8 54 Z" />
      <rect className="kw-stalk" x="8" y="58" width="20" height="30" />
      <rect className="kw-stalk" x="8" y="92" width="20" height="32" rx="3" />
      <rect className="kw-node" x="5" y="53" width="26" height="6" rx="3" />
      <rect className="kw-node" x="5" y="87" width="26" height="6" rx="3" />
      <path className="kw-leaf" d="M28 56 C 34 40, 44 30, 55 24 C 52 38, 42 50, 28 56 Z" />
      <path className="kw-leaf" d="M28 40 C 31 26, 37 16, 45 6 C 45 20, 38 32, 28 40 Z" />
    </svg>
  </span>
);

export default KawayanLogo;
