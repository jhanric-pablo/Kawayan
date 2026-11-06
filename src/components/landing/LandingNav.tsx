import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ViewState } from '../../types';
import { ArrowRight, Menu, X, Sun, Moon } from 'lucide-react';
import KawayanLogo from '../KawayanLogo';

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
  { id: 'faq', label: 'FAQ' },
];

/** The first solid background just below the header, at the page's left edge (outside the content cards). */
function sampleUnder(nav: HTMLElement | null): { css: string; luminance: number } | null {
  if (!nav) return null;
  // Its resting height, not its on-screen box: while it slides in or out the box is moved by the transform.
  const y = nav.offsetHeight + 2;
  for (const hit of document.elementsFromPoint(4, y)) {
    if (nav.contains(hit)) continue;
    for (let el: Element | null = hit; el; el = el.parentElement) {
      const css = getComputedStyle(el).backgroundColor;
      const n = css.match(/[\d.]+/g)?.map(Number);
      if (!n || n.length < 3) continue;
      // Chrome reports color-mix() results as color(srgb r g b / a) with 0-1 channels, everything else as rgb(a).
      const [r, g, b] = css.startsWith('color(') ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3);
      if ((n[3] ?? 1) < 0.5 || !/^(rgb|color\(srgb)/.test(css)) continue;
      return { css, luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
    }
    return null;
  }
  return null;
}

/**
 * Landing-page scroll-aware header.
 * - at the top: a clear full-width header; once you scroll it shrinks into a frosted floating pill
 * - the pill is tinted with the colour of the section under it, and the text turns light over dark sections
 * - hides while you scroll down past the hero, comes back as soon as you scroll up
 * - a sliding highlight follows the section in view (scrollspy); a green line inside the pill shows page progress
 * - collapses into a slide-down sheet on small screens
 */
const LandingNav: React.FC<Props> = ({ onNavigate, darkMode, toggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [onDark, setOnDark] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      // Hysteresis: become the pill past 32px, go back to the full header only near the very top.
      setScrolled((was) => (was ? y > 8 : y > 32));
      // Written straight to the DOM so scrolling doesn't re-render the header every frame.
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${h > 0 ? Math.min(1, Math.max(0, y / h)) : 0})`;
      // Take on the colour of the section just under the bar: tint the glass with it, flip the text over dark ones.
      const under = sampleUnder(navRef.current);
      if (under && navRef.current) {
        navRef.current.style.setProperty('--tint', under.css);
        setOnDark(under.luminance < 0.45);
      }
      // Hide on the way down (past the hero), show on the way up; small moves are ignored.
      if (Math.abs(y - lastY) > 6) {
        const focusInside = navRef.current?.contains(document.activeElement);
        setHidden(y > lastY && y > 480 && !focusInside);
        lastY = y;
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
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

  // The sliding highlight sits under the active link; re-measured when the header changes size.
  useLayoutEffect(() => {
    const measure = () => {
      const el = active ? linkRefs.current[active] : null;
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, scrolled]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const go = (id: string) => {
    setMenuOpen(false);
    // "How it works" opens the scroll story in its own tab; the rest scroll this page.
    if (id === 'how') { window.open('/how-it-works', '_blank', 'noopener'); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const dark = onDark && !menuOpen;
  const cls = ['lnav', scrolled && 'is-scrolled', dark && 'is-dark', hidden && !menuOpen && 'is-hidden', menuOpen && 'is-menu']
    .filter(Boolean).join(' ');

  return (
    <>
      <nav ref={navRef} className={cls} aria-label="Main">
        <div className="lnav__inner">
          <button type="button" className="lnav__brand" onClick={toTop} aria-label="Kawayan — back to top">
            <KawayanLogo size={17} onDark={dark} />
          </button>

          <div className="lnav__links">
            <span
              className="lnav__pill"
              aria-hidden="true"
              style={pill ? { transform: `translateX(${pill.x}px)`, width: pill.w, opacity: 1 } : { opacity: 0 }}
            />
            {LINKS.map((l) => (
              <button
                key={l.id}
                ref={(el) => { linkRefs.current[l.id] = el; }}
                type="button"
                className={`lnav__link${active === l.id ? ' is-active' : ''}`}
                aria-current={active === l.id ? 'location' : undefined}
                onClick={() => go(l.id)}
              >
                {l.label}
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

          <span ref={progressRef} className="lnav__progress" aria-hidden="true" />
        </div>
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
