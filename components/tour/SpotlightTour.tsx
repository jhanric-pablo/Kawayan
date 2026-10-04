import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import StepProgress from '../auth/StepProgress';
import { placePopover, type Rect } from '../../utils/tourPlacement';
import { TOUR_STEPS } from './tourSteps';
import './tour.css';

interface Props {
  open: boolean;
  onClose: () => void;
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
const SpotlightTour: React.FC<Props> = ({ open, onClose }) => {
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
      el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
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

  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const cutout = rect ?? { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };

  return (
    <>
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      <div
        className={`tour-cutout${rect ? '' : ' is-centered'}`}
        style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
      />
      <div
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

        <span className="tour-pop__icon"><Icon className="w-[1.125rem] h-[1.125rem]" /></span>
        <h2 id="tour-title" className="tour-pop__title">{current.title}</h2>
        <p className="tour-pop__body">{current.body}</p>

        <StepProgress steps={TOUR_STEPS.map((s) => s.name)} current={step} />

        <div className="tour-pop__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
            {isLast ? 'Close' : 'Skip tour'}
          </button>
          <div className="tour-pop__right">
            {step > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => go(-1)} aria-label="Previous step">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => (isLast ? onClose() : go(1))}>
              {isLast ? 'Get started' : 'Next'}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SpotlightTour;
