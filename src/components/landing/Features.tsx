import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useCycle, useInView } from './useLandingMotion';

/* ── Rewrites: the caption rewrites itself, using up the two free rewrites ── */
const VERSIONS = [
  'Bagong flavor alert! Brown sugar milk tea, 99 pesos lang this week.',
  'Sweldo week treat? Brown sugar milk tea ka muna, bes. 99 pesos lang hanggang Linggo!',
  'Pagod sa school? Reward yourself: brown sugar milk tea, 99 pesos lang this week. Tara na!',
];
const RewriteDemo: React.FC<{ run: boolean }> = ({ run }) => {
  const [v] = useCycle(VERSIONS.length, 3800, run);
  const [writing, setWriting] = useState(false);
  // A short "rewriting" beat before each new version lands.
  useEffect(() => {
    if (!run || prefersReducedMotion()) return;
    const t = setTimeout(() => setWriting(true), 3000);
    return () => { clearTimeout(t); setWriting(false); };
  }, [v, run]);
  const left = 2 - v;

  return (
    <div className="lp-rw" aria-hidden="true">
      <div className="lp-rw__card">
        <div className="lp-rw__meta">
          <span>Caption</span>
          <span className="lp-rw__ver">Version {v + 1} of 3</span>
        </div>
        {writing ? (
          <div className="lp-rw__writing"><i /><i /><i /></div>
        ) : (
          <p key={v} className="lp-rw__text">{VERSIONS[v]}</p>
        )}
      </div>
      <span className={`lp-rw__btn${writing ? ' is-busy' : ''}`}>
        {writing ? 'Rewriting…' : left > 0 ? `New version · ${left} left` : 'No rewrites left'}
      </span>
    </div>
  );
};

/* ── Reach score: the gauge fills to the score, with the reason under it ── */
const ReachDemo: React.FC<{ run: boolean }> = ({ run }) => {
  const SCORE = 82;
  const [n, setN] = useState(() => (prefersReducedMotion() ? SCORE : 0));
  useEffect(() => {
    if (!run || prefersReducedMotion()) return;
    setN(0);
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 1400);
      setN(Math.round(SCORE * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const ARC = 157; // half-circle length for r=50

  return (
    <div className="lp-reach" aria-hidden="true">
      <svg viewBox="0 0 120 68" className="lp-reach__gauge">
        <path d="M10 60 A50 50 0 0 1 110 60" className="lp-reach__track" />
        <path d="M10 60 A50 50 0 0 1 110 60" className="lp-reach__fill" style={{ strokeDasharray: ARC, strokeDashoffset: ARC * (1 - n / 100) }} />
      </svg>
      <p className="lp-reach__num"><b>{n}</b>/100</p>
      <p className="lp-reach__why">Strong opening line, and it posts at 7 PM when your followers are online.</p>
    </div>
  );
};

/* ── Preview: one post, shown the way each platform shows it ── */
const SKINS = [
  { id: 'fb', name: 'Facebook' },
  { id: 'ig', name: 'Instagram' },
  { id: 'tt', name: 'TikTok' },
];
const PreviewDemo: React.FC<{ run: boolean }> = ({ run }) => {
  const [s] = useCycle(SKINS.length, 2600, run);
  const skin = SKINS[s];
  return (
    <div className="lp-pv" aria-hidden="true">
      <div className={`lp-pv__phone lp-pv__phone--${skin.id}`}>
        <div className="lp-pv__bar">{skin.name}</div>
        <div className="lp-pv__head"><i className="lp-pv__avatar" /><span>tea.tayo</span></div>
        <div className="lp-pv__img" />
        <div className="lp-pv__lines"><i /><i /></div>
      </div>
      <div className="lp-pv__tabs">
        {SKINS.map((k, i) => <span key={k.id} className={i === s ? 'is-on' : ''}>{k.name}</span>)}
      </div>
    </div>
  );
};

/* ── Insights: two posts compared, bars grow, the better one is called out ── */
const METRICS = [
  { label: 'Reach', a: 92, b: 38 },
  { label: 'Reactions', a: 74, b: 41 },
  { label: 'Comments', a: 66, b: 22 },
];
const InsightsDemo: React.FC<{ run: boolean }> = ({ run }) => (
  <div className={`lp-ins${run ? ' is-on' : ''}`} aria-hidden="true">
    <div className="lp-ins__legend">
      <span><i className="lp-ins__key lp-ins__key--a" /> Post A · Pandesal promo</span>
      <span><i className="lp-ins__key lp-ins__key--b" /> Post B · Rainy-day champorado</span>
    </div>
    {METRICS.map((m, i) => (
      <div key={m.label} className="lp-ins__row">
        <span className="lp-ins__label">{m.label}</span>
        <span className="lp-ins__bars">
          <i className="lp-ins__bar lp-ins__bar--a" style={{ '--v': m.a / 100, '--n': i } as React.CSSProperties} />
          <i className="lp-ins__bar lp-ins__bar--b" style={{ '--v': m.b / 100, '--n': i } as React.CSSProperties} />
        </span>
      </div>
    ))}
    <p className="lp-ins__verdict">Post A reached about 2.4× more people.</p>
  </div>
);

const TILES = [
  { key: 'rw', wide: true, title: 'Rewrites that keep your voice', desc: 'Not quite right? Ask for a new version. Every post gets two free rewrites in your brand’s Taglish.', Demo: RewriteDemo },
  { key: 'reach', wide: false, title: 'A reach score before you post', desc: 'Each draft gets a 0–100 score and the reason behind it.', Demo: ReachDemo },
  { key: 'pv', wide: false, title: 'See it as your customers will', desc: 'Preview a post the way Facebook, Instagram or TikTok shows it.', Demo: PreviewDemo },
  { key: 'ins', wide: true, title: 'Learn what works', desc: 'Compare posts side by side, then export the numbers for your records.', Demo: InsightsDemo },
];

const Tile: React.FC<(typeof TILES)[number] & { index: number }> = ({ wide, title, desc, Demo, index }) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  return (
    <article ref={ref} className={`lp-feat reveal reveal--scale reveal-d${index + 1}${wide ? ' lp-feat--wide' : ''}`}>
      <div className="lp-feat__demo"><Demo run={inView} /></div>
      <h3 className="lp-feat__title">{title}</h3>
      <p className="lp-feat__desc">{desc}</p>
    </article>
  );
};

/** Features as small live demos of the real tools, instead of icons and claims. */
const Features: React.FC = () => (
  <div className="lp-feats">
    {TILES.map((t, i) => <Tile key={t.key} {...t} index={i} />)}
  </div>
);

export default Features;
