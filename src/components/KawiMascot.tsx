import React from 'react';

/** Kawi, the bamboo guide: leads the product tour and answers help questions. Eyes blink via `.kawi__eye`. */
const Kawi: React.FC<{ className?: string }> = ({ className = 'kawi__bot' }) => (
  <svg className={className} viewBox="0 0 46 66" aria-hidden="true">
    <path d="M23 12 q-11 -12 -18 -7 q9 1 18 7z" fill="#4cb27a" />
    <path d="M23 12 q8 -13 17 -9 q-9 3 -17 9z" fill="#4cb27a" />
    <rect x="8" y="11" width="30" height="51" rx="13" fill="var(--green)" />
    <rect x="6" y="38" width="34" height="4" rx="2" fill="var(--green-ink)" />
    <g className="kawi__eye"><circle cx="17" cy="25" r="4.4" fill="#fff" /><circle cx="18.2" cy="25.6" r="2.1" fill="#0a0a0a" /></g>
    <g className="kawi__eye"><circle cx="29" cy="25" r="4.4" fill="#fff" /><circle cx="30.2" cy="25.6" r="2.1" fill="#0a0a0a" /></g>
    <path d="M19 31.5 q4 3.2 8 0" stroke="#0a0a0a" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    <circle cx="12.5" cy="31" r="2" fill="#ff8fa3" opacity=".7" />
    <circle cx="33.5" cy="31" r="2" fill="#ff8fa3" opacity=".7" />
  </svg>
);

export default Kawi;
