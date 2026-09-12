import React from 'react';

/**
 * A detailed, custom-illustrated waving hand — replaces the generic lucide
 * glyph. Palm + 5 separately-animated digits (each with its own transform
 * origin at the knuckle) so the wave reads as a real gesture: the wrist
 * swings while the fingers fan and trail a beat behind, with motion-trail
 * arcs flicking in at the peak of each swing. Pure CSS/SVG, no new deps.
 */
const WaveHandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`lp-hand ${className || ''}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
    {/* motion trail — flicks in at the top of each swing */}
    <g className="lp-hand__trail" fill="none" stroke="#0E241C" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round">
      <path d="M46 14C49 12 51 9 52 6" />
      <path d="M50 20C54 19 57 17 59 14" />
    </g>

    <g className="lp-hand__group">
      {/* palm */}
      <path className="lp-hand__palm" d="M20 34C20 27 24 24 30 24H36C42 24 46 28 46 35V46C46 52 41 57 34 57H29C22 57 18 52 18 46V40C18 37 19 35 20 34Z" fill="#0E241C" />

      {/* thumb */}
      <g className="lp-hand__digit lp-hand__digit--thumb">
        <rect x="12" y="30" width="11" height="20" rx="5.5" fill="#0E241C" />
      </g>

      {/* four fingers, fanned, each its own animated group */}
      <g className="lp-hand__digit lp-hand__digit--1">
        <rect x="20" y="8" width="9" height="26" rx="4.5" fill="#0E241C" />
      </g>
      <g className="lp-hand__digit lp-hand__digit--2">
        <rect x="29.5" y="3" width="9" height="30" rx="4.5" fill="#0E241C" />
      </g>
      <g className="lp-hand__digit lp-hand__digit--3">
        <rect x="39" y="6" width="9" height="27" rx="4.5" fill="#0E241C" />
      </g>
      <g className="lp-hand__digit lp-hand__digit--4">
        <rect x="47.5" y="13" width="8" height="22" rx="4" fill="#0E241C" />
      </g>
    </g>
  </svg>
);

export default WaveHandIcon;
