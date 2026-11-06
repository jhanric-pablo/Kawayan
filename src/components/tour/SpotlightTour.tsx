import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { TOUR_STEPS, type TourStep } from './tourSteps';
import { TourDemo } from './tourDemos';
import './tour.css';
import Kawi from '../KawiMascot';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Right after brand setup: greet by name and end on "Plan my first month". */
  firstRun?: boolean;
  businessName?: string;
}

const PHONE = '(max-width: 767px)';
const GAP = 14; // between the part and Kawi
const PAD = 6; // room around the part inside the cut-out
const TAIL = 9; // the bubble's pointer
const FOLLOW_MS = 700; // keep tracking the part while the page scrolls to it
export const TOUR_OPEN_EVENT = 'kawayan:tour-open';

const isPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

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

interface Box { x: number; y: number; w: number; h: number }
type Spot = { x: number; y: number; tail: 'top' | 'bottom' | 'left' | null; at: number };

/**
 * Where the bubble (w × h) goes, always by the same rule: under the part, else over it; parts on the left
 * edge (the sidebar) get it to their right. The tail points at the part's middle. A part too big for either
 * (the whole calendar) gets the bubble in the bottom-right corner over it, without a tail.
 */
function place(r: Box | null, w: number, h: number): Spot {
  const W = window.innerWidth, H = window.innerHeight, g = GAP + TAIL;
  if (!r) return { x: (W - w) / 2, y: (H - h) / 2, tail: null, at: 0 };
  const mx = r.x + r.w / 2, my = r.y + r.h / 2;
  const x = clamp(mx - w / 2, 8, W - w - 8), ax = clamp(mx - x, 24, w - 24);
  const below: Spot = { x, y: r.y + r.h + g, tail: 'top', at: ax };
  const above: Spot = { x, y: r.y - h - g, tail: 'bottom', at: ax };
  const ry = clamp(my - h / 2, 8, H - h - 8);
  const right: Spot = { x: r.x + r.w + g, y: ry, tail: 'left', at: clamp(my - ry, 24, h - 24) };
  const fits = (p: Spot) => p.x >= 8 && p.y >= 8 && p.x + w <= W - 8 && p.y + h <= H - 8;
  const onLeftEdge = r.x + r.w < W * 0.3;
  const order = onLeftEdge ? [right, below, above] : [below, above, right];
  return order.find(fits) ?? { x: W - w - 24, y: H - h - 24, tail: null, at: 0 };
}


/**
 * Guided tour over the live app, led by Kawi: the page greys out except the part being explained,
 * and Kawi hops next to it with a bubble that points at it (a looping preview of what the part does, a sentence or two,
 * Back / Next). Runs once after brand setup and from "Take the tour".
 *
 * - The cut-out and Kawi are portalled to <body>; the page is locked while the tour runs.
 * - Steps whose target isn't visible (collapsed sidebar, phone drawer, a removed panel) are skipped.
 * - On phones the bubble is a sheet at the bottom and the part is scrolled to the top above it.
 * - Arrows move, Esc closes, focus stays inside the bubble.
 */
const SpotlightTour: React.FC<Props> = ({ open, onClose, firstRun = false, businessName }) => {
  const [step, setStep] = useState(0);
  const unitRef = useRef<HTMLDivElement>(null);
  const bubRef = useRef<HTMLDivElement>(null);
  const [hole, setHole] = useState<Box | null>(null);
  const [pos, setPos] = useState<Spot | null>(null);
  const [sheet, setSheet] = useState(false);
  const [, setRecount] = useState(0);

  const current = TOUR_STEPS[step];

  // Lock the page while the tour runs.
  useEffect(() => {
    if (!open) return;
    // Close the phone menu drawer (it hides the page from assistive tech, which would hide the targets).
    window.dispatchEvent(new Event(TOUR_OPEN_EVENT));
    const first = TOUR_STEPS.findIndex(canShow);
    setStep(first < 0 ? 0 : first);
    // Re-count once the drawer has closed and the page is visible again.
    const t = window.setTimeout(() => setRecount((n) => n + 1), 400);
    const html = document.documentElement;
    html.classList.add('tour-lock');
    return () => { window.clearTimeout(t); html.classList.remove('tour-lock'); };
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

  // Cut out this step's part and move Kawi next to it. The page scrolls smoothly to the part,
  // so follow it frame by frame for a moment; again whenever the window changes size.
  useLayoutEffect(() => {
    if (!open || !current) return;
    const el = findAnchor(current.anchor);
    const phone = isPhone();
    el?.scrollIntoView({ block: phone ? 'start' : 'nearest', inline: 'nearest', behavior: 'smooth' });
    const aim = () => {
      const r = el?.getBoundingClientRect();
      const box = r ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
      setHole((b) => (b && box && b.x === box.x && b.y === box.y && b.w === box.w && b.h === box.h ? b : box));
      const sh = isPhone();
      setSheet(sh);
      const u = unitRef.current;
      if (!sh && u) {
        const p = place(box, u.offsetWidth, u.offsetHeight);
        setPos((o) => (o && o.x === p.x && o.y === p.y && o.tail === p.tail && o.at === p.at ? o : p));
      }
    };
    aim();
    let raf = 0;
    const until = performance.now() + FOLLOW_MS;
    const follow = () => { aim(); if (performance.now() < until) raf = requestAnimationFrame(follow); };
    raf = requestAnimationFrame(follow);
    window.addEventListener('resize', aim);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', aim); };
  }, [open, step, current]);

  // Focus into the bubble on every step so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (open) bubRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the bubble: the rest of the app is behind the blocker.
    const focusables = bubRef.current?.querySelectorAll<HTMLElement>('button');
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === bubRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!open || !current) return null;

  // "Step 3 of 14" over the steps this screen can show.
  const visible = TOUR_STEPS.map((s, i) => (canShow(s) ? i : -1)).filter((i) => i >= 0);
  const position = Math.max(1, visible.indexOf(step) + 1);
  const total = Math.max(1, visible.length);

  const isFirst = step === visible[0];
  const isLast = step === visible[visible.length - 1];
  const title = isFirst && firstRun ? `Welcome to Kawayan${businessName ? `, ${businessName}` : ''}` : current.title;
  const body = isFirst
    ? `Hi, I’m Kawi! ${firstRun ? 'Your brand is set up, so every caption is written in your voice. Let me show you where everything is; it takes about two minutes.' : current.body}`
    : current.body;
  const planAnchor = findAnchor('plan-month');

  const planFirstMonth = () => {
    onClose();
    window.setTimeout(() => findAnchor('plan-month')?.click(), 100);
  };

  const demoId = current.anchor ?? (isLast ? 'done' : 'welcome');
  // No part to point at: the cut-out shrinks to the middle, so the whole page is grey.
  const cut = hole ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };

  return createPortal(
    <>
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      <div className={`tour-hole${hole ? '' : ' is-empty'}`} style={{ left: cut.x, top: cut.y, width: cut.w, height: cut.h }} aria-hidden="true" />

      <div
        ref={unitRef}
        className={`kawi${sheet ? ' is-sheet' : ''}${pos || sheet ? '' : ' is-hidden'}`}
        style={sheet || !pos ? undefined : { left: pos.x, top: pos.y }}
      >
        {/* Kawi peeks over the top, on the side away from the tail. */}
        <div key={step} className={`kawi__hop${!sheet && pos?.tail === 'top' && pos.at > 200 ? ' is-left' : ''}`}><Kawi /></div>
        {!sheet && pos?.tail && (
          <span className={`kawi__tail kawi__tail--${pos.tail}`} style={pos.tail === 'left' ? { top: pos.at } : { left: pos.at }} aria-hidden="true" />
        )}
        <div
          ref={bubRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="kawi__bub"
        >
          {/* What happens when you use this part, acted out. */}
          <div className="tour-demo" aria-hidden="true">
            <TourDemo key={step} id={demoId} biz={businessName} />
          </div>

          <div className="kawi__head">
            <span className="kawi__dots" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={position} aria-valuetext={`Step ${position} of ${total}`}>
              {visible.map((i) => <i key={i} className={i === step ? 'on' : ''} />)}
            </span>
            <small>{position}/{total} · {current.chapter}</small>
            <button type="button" className="kawi__close" onClick={onClose} aria-label="Skip the tour"><X aria-hidden /></button>
          </div>

          <div key={step} className="kawi__txt">
            <h2 id="tour-title">{title}</h2>
            <p id="tour-body">{body}</p>
          </div>

          <div className="kawi__actions">
            {!isFirst && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(-1)}>
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
              </button>
            )}
            {isLast ? (
              <>
                <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Explore on my own</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={planAnchor ? planFirstMonth : onClose}>
                  {planAnchor ? 'Plan my first month' : 'Get started'} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => go(1)}>
                {isFirst ? 'Start the tour' : 'Next'} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default SpotlightTour;
