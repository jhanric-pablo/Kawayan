import React from 'react';
import './authShell.css';

interface Props {
  onBack: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  darkMode?: boolean;
  toggleTheme?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Centred auth stage: ambient dot field (with a spotlight that tracks the
 * cursor), a slim top bar, a brand header and one card. Shared by sign-in,
 * sign-up and password reset so all three have the same footprint.
 */
const AuthShell: React.FC<Props> = ({
  onBack, eyebrow, title, subtitle, darkMode, toggleTheme, footer, children,
}) => (
  <div
    className="ax"
    onMouseMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--ax-mx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--ax-my', `${e.clientY - r.top}px`);
    }}
  >
    <div className="ax__field" aria-hidden="true">
      <span className="ax__orb ax__orb--1" />
      <span className="ax__orb ax__orb--2" />
      <span className="ax__dots" />
      <span className="ax__dots ax__dots--glow" />
    </div>

    <div className="ax__bar">
      <button type="button" className="ax__back" onClick={onBack}>← Kawayan</button>
      {toggleTheme && (
        <button type="button" className="ax__theme" onClick={toggleTheme}>
          {darkMode ? 'Light' : 'Dark'}
        </button>
      )}
    </div>

    <div className="ax__stage">
      <header className="ax__head">
        <button type="button" className="ax__mark" onClick={onBack} title="Back to home">
          <img src="/logo.png" alt="" />
          <span>Kawayan AI</span>
        </button>
        {eyebrow && <div><span className="ax__eyebrow">{eyebrow}</span></div>}
        <h1 className="ax__title">{title}</h1>
        {subtitle && <p className="ax__sub">{subtitle}</p>}
      </header>

      <div className="ax__card">{children}</div>

      {footer}
    </div>
  </div>
);

export default AuthShell;
