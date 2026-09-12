import React from 'react';

/**
 * A detailed 3-stalk bamboo cluster — replaces the single-stalk sketch.
 * Each stalk grows joint-by-joint (staggered scaleY per segment, like real
 * bamboo shooting up in visible increments) then settles into an independent
 * gentle sway. Leaves unfurl at multiple heights, not just the crown, each
 * with its own sway timing for a natural wind-blown feel. Pure CSS/SVG.
 */
const BambooGrowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`lp-bamboo2 ${className || ''}`.trim()} viewBox="0 0 100 122" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs>
      <linearGradient id="bambooMain" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#5E7F63" />
        <stop offset="1" stopColor="#9CB080" />
      </linearGradient>
      <linearGradient id="bambooSide" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#4C6B52" />
        <stop offset="1" stopColor="#7E9B6E" />
      </linearGradient>
      <ellipse id="bambooShadow" cx="50" cy="119" rx="26" ry="3" />
    </defs>

    <use href="#bambooShadow" fill="#0E241C" opacity="0.25" />

    {/* left stalk — shorter, set back */}
    <g className="lp-bamboo2__stalk lp-bamboo2__stalk--l">
      <g className="lp-bamboo2__seg lp-bamboo2__seg--1">
        <rect x="19" y="88" width="9" height="31" rx="4" fill="url(#bambooSide)" />
      </g>
      <g className="lp-bamboo2__seg lp-bamboo2__seg--2">
        <rect x="19" y="62" width="9" height="28" rx="4" fill="url(#bambooSide)" />
      </g>
      <path className="lp-bamboo2__node" d="M17.5 87h12" stroke="#37503C" strokeWidth="1.6" strokeLinecap="round" />
      <g className="lp-bamboo2__leafset lp-bamboo2__leafset--l1">
        <path d="M23 63C15 61 8 56 5 49C13 48 22 53 26 60Z" fill="#7E9B6E" />
      </g>
    </g>

    {/* right stalk — shorter, set back */}
    <g className="lp-bamboo2__stalk lp-bamboo2__stalk--r">
      <g className="lp-bamboo2__seg lp-bamboo2__seg--1">
        <rect x="72" y="94" width="9" height="25" rx="4" fill="url(#bambooSide)" />
      </g>
      <g className="lp-bamboo2__seg lp-bamboo2__seg--2">
        <rect x="72" y="70" width="9" height="26" rx="4" fill="url(#bambooSide)" />
      </g>
      <path className="lp-bamboo2__node" d="M70.5 93h12" stroke="#37503C" strokeWidth="1.6" strokeLinecap="round" />
      <g className="lp-bamboo2__leafset lp-bamboo2__leafset--r1">
        <path d="M77 71C85 69 92 64 95 57C87 56 78 61 74 68Z" fill="#8AA773" />
      </g>
    </g>

    {/* centre stalk — tallest, foreground */}
    <g className="lp-bamboo2__stalk lp-bamboo2__stalk--c">
      <g className="lp-bamboo2__seg lp-bamboo2__seg--1">
        <rect x="43" y="94" width="14" height="25" rx="6" fill="url(#bambooMain)" />
      </g>
      <g className="lp-bamboo2__seg lp-bamboo2__seg--2">
        <rect x="43" y="68" width="14" height="27" rx="6" fill="url(#bambooMain)" />
      </g>
      <g className="lp-bamboo2__seg lp-bamboo2__seg--3">
        <rect x="43" y="44" width="14" height="25" rx="6" fill="url(#bambooMain)" />
      </g>
      <g className="lp-bamboo2__seg lp-bamboo2__seg--4">
        <rect x="43" y="22" width="14" height="23" rx="6" fill="url(#bambooMain)" />
      </g>
      <path className="lp-bamboo2__node" d="M41 93h18M41 67h18M41 43h18" stroke="#3F5A46" strokeWidth="2" strokeLinecap="round" />

      <g className="lp-bamboo2__leafset lp-bamboo2__leafset--mid">
        <path d="M43 70C33 68 24 63 19 54C29 52 40 58 45 67Z" fill="#8AA773" opacity="0.9" />
      </g>
      <g className="lp-bamboo2__leafset lp-bamboo2__leafset--crown">
        <path className="lp-bamboo2__leaf lp-bamboo2__leaf--l" d="M49 30C37 28 27 22 22 12C33 10 46 17 51 27Z" fill="#8AA773" />
        <path className="lp-bamboo2__leaf lp-bamboo2__leaf--c" d="M50 26C49 13 52 5 57 1C62 8 60 19 54 26Z" fill="#C2D6B6" />
        <path className="lp-bamboo2__leaf lp-bamboo2__leaf--r" d="M51 30C63 28 73 22 78 12C67 10 54 17 49 27Z" fill="#9CB080" />
      </g>
    </g>
  </svg>
);

export default BambooGrowIcon;
