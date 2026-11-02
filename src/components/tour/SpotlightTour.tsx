import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Lightbulb, Check } from 'lucide-react';
import { placePopover, type Rect } from '../../utils/tourPlacement';
import { TOUR_STEPS } from './tourSteps';
import './tour.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Right after brand setup: greet by name and end on "Plan my first month". */
  firstRun?: boolean;
  businessName?: string;
}

const GUTTER = 12;
const PAD = 6; // breathing room around the highlighted element

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const findAnchor = (anchor: string | null): HTMLElement | null =>
  anchor ? document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`) : null;

/**
 * Coachmark tour over the live UI: dims the app, cuts a hole around one real
 * element at a time, and explains it. Runs once after brand setup and on demand
 * from Settings.
 *
 * Steps whose anchor isn't in the DOM are skipped rather than shown floating —
 * the nav pills are role-filtered and hidden entirely for unverified users.
 */
const SpotlightTour: React.FC<Props> = ({ open, onClose, firstRun = false, businessName }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, side: 'center' as 'top' | 'bottom' | 'center' });

  const current = TOUR_STEPS[step];

  // Restart from the top each time the tour is opened (incl. Settings replay).
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  /** Walk past steps whose anchor isn't rendered in this session. */
  const nextVisible = useCallback((from: number, dir: 1 | -1): number | null => {
    for (let i = from; i >= 0 && i < TOUR_STEPS.length; i += dir) {
      const s = TOUR_STEPS[i];
      if (!s.anchor || findAnchor(s.anchor)) return i;
    }
    return null;
  }, []);

  const go = useCallback((dir: 1 | -1) => {
    const target = nextVisible(step + dir, dir);
    if (target === null) {
      if (dir === 1) onClose();
      return;
    }
    setStep(target);
  }, [step, nextVisible, onClose]);

  const measure = useCallback(() => {
    const el = findAnchor(current?.anchor ?? null);
    let anchorRect: Rect | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      anchorRect = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    }
    setRect(anchorRect);

    const pop = popRef.current;
    const size = pop
      ? { width: pop.offsetWidth, height: pop.offsetHeight }
      : { width: 368, height: 220 };
    setPos(placePopover(anchorRect, size, { width: window.innerWidth, height: window.innerHeight }, GUTTER));
  }, [current]);

  // Scroll the anchor into view, then measure it.
  useLayoutEffect(() => {
    if (!open || !current) return;
    const el = findAnchor(current.anchor);
    if (el) {
      // Tall things (the tray) scroll to their top, clear of the sticky top bar; the rest centre.
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
      el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    measure();
    // Re-measure after the smooth scroll settles, and once the popover has its
    // real height (first pass uses an estimate).
    const t = window.setTimeout(measure, 320);
    return () => window.clearTimeout(t);
  }, [open, step, current, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  // Move focus into the card on every step so screen readers follow along.
  useEffect(() => {
    if (open) popRef.current?.focus();
  }, [open, step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key !== 'Tab') return;
    // Trap Tab inside the card — the rest of the app is behind a scrim.
    const focusables = popRef.current?.querySelectorAll<HTMLElement>('button');
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!open || !current) return null;

  // Count only the steps this screen can show (the tray is hidden on phones, for example).
  const visible = TOUR_STEPS.map((s, i) => i).filter((i) => !TOUR_STEPS[i].anchor || findAnchor(TOUR_STEPS[i].anchor));
  const position = Math.max(1, visible.indexOf(step) + 1);
  const total = visible.length;

  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const title = isFirst && firstRun ? `Welcome to Kawayan${businessName ? `, ${businessName}` : ''}` : current.title;
  const body = isFirst && firstRun
    ? 'Your brand is set up, so every caption is written in your voice. Here’s where everything is; it takes about two minutes.'
    : current.body;
  const cutout = rect ?? { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };

  const planFirstMonth = () => {
    onClose();
    // Open the planner the tour just pointed at.
    window.setTimeout(() => findAnchor('plan-month')?.click(), 120);
  };

  return (
    <>
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      <div
        className={`tour-cutout${rect ? '' : ' is-centered'}`}
        style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
      />
      <div
        key={step}
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`tour-pop kw-sheet tour-pop--${pos.side}`}
        style={{ top: pos.top, left: pos.left }}
      >
        <span className="tour-pop__arrow" aria-hidden="true" />

        <div className="tour-pop__head">
          <span className="tour-pop__icon"><Icon className="w-4.5 h-4.5" /></span>
          <span className="tour-pop__chapter">{current.chapter}</span>
          <span className="tour-pop__count">{position} of {total}</span>
        </div>
        <h2 id="tour-title" className="tour-pop__title">{title}</h2>
        <p className="tour-pop__body">{body}</p>

        {current.points && (
          <ul className="tour-pop__points">
            {current.points.map((p) => (
              <li key={p}><Check aria-hidden /> {p}</li>
            ))}
          </ul>
        )}
        {current.tip && (
          <p className="tour-pop__tip"><Lightbulb aria-hidden /> {current.tip}</p>
        )}

        <div className="tour-pop__progress" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={position}>
          <i style={{ width: `${(position / total) * 100}%` }} />
        </div>

        <div className="tour-pop__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {isLast ? 'Explore on my own' : <><X className="w-3.5 h-3.5" /> Skip tour</>}
          </button>
          <div className="tour-pop__right">
            {step > 0 && !isLast && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => go(-1)} aria-label="Previous step">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {isLast ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={findAnchor('plan-month') ? planFirstMonth : onClose}>
                {findAnchor('plan-month') ? 'Plan my first month' : 'Get started'} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => go(1)}>
                {isFirst ? 'Start the tour' : 'Next'} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="tour-pop__keys" aria-hidden="true">← → to move · Esc to close</p>
      </div>
    </>
  );
};

export default SpotlightTour;
