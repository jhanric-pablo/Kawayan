import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { KawayanMark } from '../KawayanLogo';
import { ViewState } from '../../types';
import { prefersReducedMotion, useInView } from './useLandingMotion';
import { SHOPS, shot, type Shop } from './shops';

const TYPE_MS = 28;
const PRESS_MS = 450;
const HOLD_MS = 3400;

const WHEN = ['Mon 3 · 6:00 AM', 'Wed 5 · 9:00 AM', 'Fri 7 · 7:30 AM'];
const label = (shop: Shop) => shop.type.split(' / ')[0].toLowerCase();
const PROMPTS = [
  (t: string) => `Gawan mo ako ng payday promo para sa ${t} ko`,
  (t: string) => `Weekend posts para sa ${t} ko, Taglish please`,
  (t: string) => `Plan this week's posts for my ${t}`,
];

/** The shop type inside the sentence: a slot-machine roll, and the box resizes to the word. */
const RollingType: React.FC<{ index: number }> = ({ index }) => {
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [width, setWidth] = useState<number>();
  // Past the last shop the track rolls onto a copy of the first, then snaps back without a transition.
  const [row, setRow] = useState(index);
  const [snap, setSnap] = useState(false);
  useEffect(() => {
    if (index === 0 && row === SHOPS.length - 1) {
      setRow(SHOPS.length);
      const t = setTimeout(() => { setSnap(true); setRow(0); }, 650);
      return () => clearTimeout(t);
    }
    setSnap(false);
    setRow(index);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = itemRefs.current[row];
    if (el) setWidth(el.getBoundingClientRect().width);
  }, [row]);
  const words = [...SHOPS, SHOPS[0]].map(label);
  return (
    <span className="lp-roll" style={{ width }} aria-hidden="true">
      <span className={`lp-roll__track${snap ? ' is-snap' : ''}`} style={{ transform: `translateY(-${row * 1.5}em)` }}>
        {words.map((w, i) => <span key={i} ref={(el) => { itemRefs.current[i] = el; }}>{w}</span>)}
      </span>
    </span>
  );
};

/**
 * The hero: the pitch with a rolling shop type, then a prompt bar that types a request for that shop and
 * fans out the three posts Kawayan makes, then a strip of every shop type with the current one lit.
 * One loop drives all of it: roll the word, type the prompt, press Generate, show the posts, next shop.
 */
const HeroShowcase: React.FC<{ onNavigate: (v: ViewState) => void }> = ({ onNavigate }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, 0.2);
  const [pos, setPos] = useState(0);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'press' | 'shown'>('shown');
  // The fanned posts belong to the last request that finished; they stay (dimmed) while the next one types.
  const [fanPos, setFanPos] = useState<number | null>(null);
  const shop = SHOPS[pos];
  const prompt = PROMPTS[pos % PROMPTS.length](label(shop));

  useEffect(() => {
    if (prefersReducedMotion()) { setTyped(prompt); setPhase('shown'); setFanPos(pos); return; }
    if (!inView) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    setTyped(''); setPhase('typing');
    const type = () => {
      setTyped(prompt.slice(0, ++n));
      if (n < prompt.length) { t = setTimeout(type, TYPE_MS); return; }
      setPhase('press');
      t = setTimeout(() => {
        setPhase('shown');
        setFanPos(pos);
        t = setTimeout(() => setPos((p) => (p + 1) % SHOPS.length), HOLD_MS);
      }, PRESS_MS);
    };
    t = setTimeout(type, 500);
    return () => clearTimeout(t);
  }, [pos, inView, prompt]);

  return (
    <div ref={rootRef} className="lp-hs">
      {/* 1. The pitch */}
      <div className="lp-hs__copy">
        <span className="lp-hs__kicker lp-rise" style={{ '--d': 0 } as React.CSSProperties}><i className="lp-ping" aria-hidden="true" /><b>New</b> For every Filipino MSME</span>
        <h1 className="lp-hs__title">
          <span className="lp-rise" style={{ '--d': 1 } as React.CSSProperties}>Social Media</span>{' '}
          <em className="lp-shiny" style={{ '--d': 2 } as React.CSSProperties}>
            On Autopilot.
            <svg viewBox="0 0 600 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 14 C 150 2, 300 4, 596 10" /></svg>
          </em>
        </h1>
        <p className="lp-hs__lede lp-rise" style={{ '--d': 3 } as React.CSSProperties}>
          Taglish captions, images and a posting schedule for your <RollingType index={pos} />
          <span className="sr-only">{label(shop)}</span>, all on one calendar.
        </p>

        {/* 2. Ask Kawayan: a typed request, then the three posts it makes */}
        <div className="lp-ask lp-rise" style={{ '--d': 4 } as React.CSSProperties} aria-hidden="true">
          <KawayanMark className="lp-ask__icon" size={18} />
          <span className={`lp-ask__txt${phase === 'typing' ? ' is-typing' : ''}`}>{typed}</span>
          <span className={`lp-ask__go${phase === 'press' ? ' is-press' : ''}`}>Generate</span>
        </div>
        <div className={`lp-fan${phase === 'shown' ? '' : ' is-stale'}`} aria-hidden="true">
          {fanPos !== null && SHOPS[fanPos].week.map((title, i) => (
            <div key={`${fanPos}-${i}`} className="lp-fan__card">
              <img decoding="async" src={shot(SHOPS[fanPos], (i + 1) as 1 | 2 | 3)} alt="" />
              <b>{title}</b>
              <small className="mono">{WHEN[i]}</small>
            </div>
          ))}
        </div>

        <div className="lp-hs__actions lp-rise" style={{ '--d': 5 } as React.CSSProperties}>
          <button type="button" onClick={() => onNavigate(ViewState.SIGNUP)} className="btn btn-primary btn-lg lp-hs__cta">
            Start Free Trial <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <a href="/how-it-works" target="_blank" rel="noopener" className="btn btn-outline btn-lg">See how it works</a>
        </div>
        <p className="lp-hs__fine lp-rise" style={{ '--d': 6 } as React.CSSProperties}>Create your first content calendar in minutes. No credit card required.</p>
        <p className="sr-only" aria-live="polite">Showing a sample post for a {shop.type}.</p>
      </div>

      {/* 3. Every business type, sliding past; the shop in the sentence above is lit up */}
      <div className="lp-hs__strip" aria-hidden="true">
        <div>
          {[...SHOPS, ...SHOPS].map((s, i) => (
            <span key={i} className={s.key === shop.key ? 'is-on' : undefined}>{label(s)}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroShowcase;
