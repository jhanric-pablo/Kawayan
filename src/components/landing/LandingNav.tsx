import React, { useEffect, useState } from 'react';
import { ViewState } from '../../types';
import { ArrowRight, Menu, X, Sun, Moon } from 'lucide-react';

interface Props {
  onNavigate: (v: ViewState) => void;
  darkMode: boolean;
  toggleTheme: () => void;
}

const LINKS: { id: string; label: string }[] = [
  { id: 'how', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'why', label: 'Why Kawayan' },
  { id: 'pricing', label: 'Pricing' },
];

/**
 * Landing-page top navigation.
 * - transparent over the dark hero, condenses into a glass bar on scroll
 * - scroll-progress hairline + active-section highlight (IntersectionObserver)
 * - collapses into a slide-down sheet on small screens
 */
const LandingNav: React.FC<Props> = ({ onNavigate, darkMode, toggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 24);
      setProgress(h > 0 ? Math.min(1, Math.max(0, y / h)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const sections = LINKS
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (seen[0]) setActive(seen[0].target.id);
        else if (window.scrollY < window.innerHeight * 0.6) setActive('');
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.2, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const go = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      <nav className={`lnav${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-menu' : ''}`}>
        <div className="lnav__inner">
          <button type="button" className="lnav__brand" onClick={toTop} aria-label="Kawayan — back to top">
            <span className="lnav__logo">
              <img src="/logo.png" alt="" />
              <i className="lnav__logo-ring" aria-hidden="true" />
            </span>
            <span className="lnav__word">Kawayan<i>.</i></span>
          </button>

          <div className="lnav__links">
            {LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`lnav__link${active === l.id ? ' is-active' : ''}`}
                onClick={() => go(l.id)}
              >
                {l.label}
                <i className="lnav__link-bar" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="lnav__actions">
            <button
              type="button"
              className="lnav__icon"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button type="button" className="lnav__signin" onClick={() => onNavigate(ViewState.LOGIN)}>
              Sign In
            </button>
            <button type="button" className="lnav__cta" onClick={() => onNavigate(ViewState.SIGNUP)}>
              <span>Get Started</span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lnav__burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        <span className="lnav__progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      </nav>

      <div className={`lnav-sheet${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="lnav-sheet__links">
          {LINKS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              className={`lnav-sheet__link${active === l.id ? ' is-active' : ''}`}
              style={{ transitionDelay: `${menuOpen ? 0.05 + i * 0.04 : 0}s` }}
              onClick={() => go(l.id)}
            >
              <span>{l.label}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="lnav-sheet__foot">
          <button
            type="button"
            className="lnav-sheet__signin"
            onClick={() => { setMenuOpen(false); onNavigate(ViewState.LOGIN); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className="lnav-sheet__cta"
            onClick={() => { setMenuOpen(false); onNavigate(ViewState.SIGNUP); }}
          >
            Get Started <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      {menuOpen && <button type="button" className="lnav-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    </>
  );
};

export default LandingNav;
