import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { placePopover, type Rect } from '../../utils/tourPlacement';
import { TOUR_STEPS, type TourStep } from './tourSteps';
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
const PHONE = '(max-width: 767px)';
export const TOUR_OPEN_EVENT = 'kawayan:tour-open';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches;

/** The anchor only if it's really on screen: present, laid out (not display:none / zero size), visible. */
const findAnchor = (anchor: string | null): HTMLElement | null => {
  if (!anchor) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || el.closest('[inert], [aria-hidden="true"]')) continue;
    return el;
  }
  return null;
};

/** A step can show when it suits this screen size and its anchor (if any) is visible. */
const canShow = (s: TourStep) => (s.phone !== false || !isPhone()) && (!s.anchor || !!findAnchor(s.anchor));

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/**
 * Coachmark tour over the live UI: dims the app, cuts a hole around one real element at a time,
 * and explains it. Runs once after brand setup and from "Take the tour".
 *
 * - The target is scrolled into view (smoothly, unless reduced motion), and the spotlight and
 *   card follow it every frame while the tour is open: scrolling, resizing, the sidebar
 *   collapsing, late layout shifts.
 * - Steps whose target isn't visible (collapsed sidebar, phone drawer, a removed panel) are
 *   skipped, never shown at a wrong spot. Phones get a bottom sheet and fewer steps.
 * - Card: "Step X of Y", title, a line or two, Back / Next / Skip; Esc closes; focus stays inside.
 */
const SpotlightTour: React.FC<Props> = ({ open, onClose, firstRun = false, businessName }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [phone, setPhone] = useState(isPhone);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, side: 'center' as 'top' | 'bottom' | 'center' });
  const lastRect = useRef<Rect | null>(null);
  const [, setRecount] = useState(0);

  const current = TOUR_STEPS[step];

  // Restart at the first step that can show, each time the tour opens.
  useEffect(() => {
    if (!open) return;
    // Close the phone menu drawer (it hides the page from assistive tech, which would hide the targets).
    window.dispatchEvent(new Event(TOUR_OPEN_EVENT));
    setPhone(isPhone());
    const first = TOUR_STEPS.findIndex(canShow);
    setStep(first < 0 ? 0 : first);
    // Re-count once the drawer has closed and the page is visible again.
    const t = window.setTimeout(() => setRecount((n) => n + 1), 400);
    return () => window.clearTimeout(t);
  }, [open]);

  /** The next step (in direction dir) that can show on this screen. */
  const nextVisible = useCallback((from: number, dir: 1 | -1): number | null => {
    for (let i = from; i >= 0 && i < TOUR_STEPS.length; i += dir) if (canShow(TOUR_STEPS[i])) return i;
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

  // Measure the target and place the card; only re-render when something moved.
  const measure = useCallback(() => {
    const el = findAnchor(current?.anchor ?? null);
    let anchorRect: Rect | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      anchorRect = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    }
    if (!sameRect(anchorRect, lastRect.current) || !lastRect.current) {
      lastRect.current = anchorRect;
      setRect(anchorRect);
    }
    const nowPhone = isPhone();
    setPhone((p) => (p === nowPhone ? p : nowPhone));
    if (nowPhone) return; // bottom sheet: CSS places it
    const pop = popRef.current;
    const size = pop ? { width: pop.offsetWidth, height: pop.offsetHeight } : { width: 368, height: 200 };
    const next = placePopover(anchorRect, size, { width: window.innerWidth, height: window.innerHeight }, GUTTER);
    setPos((p) => (p.top === next.top && p.left === next.left && p.side === next.side ? p : next));
  }, [current]);

  // A step's target vanished (e.g. the sidebar collapsed mid-tour): move on instead of floating.
  const skipIfGone = useCallback(() => {
    if (current?.anchor && !findAnchor(current.anchor)) {
      const target = nextVisible(step + 1, 1) ?? nextVisible(step - 1, -1);
      if (target !== null && target !== step) setStep(target);
    }
  }, [current, step, nextVisible]);

  // Bring the target into view (smoothly unless reduced motion), then measure.
  useLayoutEffect(() => {
    if (!open || !current) return;
    lastRect.current = null;
    const el = findAnchor(current.anchor);
    if (el) {
      const r = el.getBoundingClientRect();
      const offscreen = r.top < 64 || r.bottom > window.innerHeight - (isPhone() ? 260 : 24);
      if (offscreen) {
        const tall = r.height > window.innerHeight * 0.55;
        el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }
    measure();
  }, [open, step, current, measure]);

  // Follow the target every frame while open (scroll, resize, sidebar animation, layout shifts).
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let frames = 0;
    const tick = () => {
      measure();
      if (++frames % 30 === 0) skipIfGone();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, measure, skipIfGone]);

  // Focus into the card on every step so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (open) popRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the card: the rest of the app is behind the scrim.
    const focusables = popRef.current?.querySelectorAll<HTMLElement>('button');
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === popRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!open || !current) return null;

  // "Step X of Y" over the steps this screen can show.
  const visible = TOUR_STEPS.map((s, i) => (canShow(s) ? i : -1)).filter((i) => i >= 0);
  const position = Math.max(1, visible.indexOf(step) + 1);
  const total = Math.max(1, visible.length);

  const Icon = current.icon;
  const isFirst = step === visible[0];
  const isLast = step === visible[visible.length - 1];
  const title = isFirst && firstRun ? `Welcome to Kawayan${businessName ? `, ${businessName}` : ''}` : current.title;
  const body = isFirst && firstRun
    ? 'Your brand is set up, so every caption is written in your voice. Here’s where everything is; it takes about two minutes.'
    : current.body;
  const cutout = rect ?? { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };
  const planAnchor = findAnchor('plan-month');

  const planFirstMonth = () => {
    onClose();
    window.setTimeout(() => findAnchor('plan-month')?.click(), 120);
  };

  return (
    <>
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      <div
        className={`tour-cutout${rect ? '' : ' is-centered'}`}
        style={{ transform: `translate(${cutout.left}px, ${cutout.top}px)`, width: cutout.width, height: cutout.height }}
      />
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`tour-pop kw-sheet ${phone ? 'tour-pop--sheet' : `tour-pop--${pos.side}`}`}
        style={phone ? undefined : { transform: `translate(${pos.left}px, ${pos.top}px)` }}
      >
        {!phone && <span className="tour-pop__arrow" aria-hidden="true" />}
        <div key={step} className="tour-pop__inner">
          <div className="tour-pop__head">
            <span className="tour-pop__icon"><Icon className="w-4 h-4" /></span>
            <span className="tour-pop__chapter">{current.chapter}</span>
            <span className="tour-pop__count">Step {position} of {total}</span>
          </div>
          <h2 id="tour-title" className="tour-pop__title">{title}</h2>
          <p id="tour-body" className="tour-pop__body">{body}</p>
          {current.tip && !phone && (
            <p className="tour-pop__tip"><Lightbulb aria-hidden /> {current.tip}</p>
          )}

          <div className="tour-pop__progress" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={position}>
            <i style={{ transform: `scaleX(${position / total})` }} />
          </div>

          <div className="tour-pop__actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              {isLast ? 'Explore on my own' : <><X className="w-3.5 h-3.5" /> Skip</>}
            </button>
            <div className="tour-pop__right">
              {!isFirst && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => go(-1)}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              {isLast ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={planAnchor ? planFirstMonth : onClose}>
                  {planAnchor ? 'Plan my first month' : 'Get started'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => go(1)}>
                  {isFirst ? 'Start' : 'Next'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {!phone && <p className="tour-pop__keys" aria-hidden="true">← → to move · Esc to close</p>}
        </div>
      </div>
    </>
  );
};

export default SpotlightTour;
