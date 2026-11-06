import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import {
  ArrowRight, ArrowUp, BadgeCheck, BarChart3, CalendarRange, Check, Clock, FileSearch, Heart, Languages, MessageCircle, Mic, PenLine, Repeat2, Send, ShieldCheck, Store, Target, Users, ImagePlus,
} from 'lucide-react';
import { KawayanMark } from '../KawayanLogo';
import KawayanLogo from '../KawayanLogo';
import { SHOPS, shot, type Shop } from '../landing/shops';
import './story.css';

/**
 * /how-it-works — Kawayan's scroll story (opens in a new tab from the landing page).
 * Hero with an "ask anything" bar over a 3D scene, then one pinned section that walks through the
 * five steps as you scroll: text on the left, a 3D panel and four features on the right.
 * Reduced motion: nothing types or spins on its own, and the steps become a normal list.
 */

const POSTS = SHOPS.slice(0, 8);

/* ── typewriter for the ask bar ── */
const PROMPTS = [
  'Plan my November posts for a panaderia in Parañaque',
  'Gawa ka ng payday promo para sa milk tea kiosk ko',
  'Write a Taglish post for our new ube ensaymada',
  'Ano ang magandang post para sa Undas?',
];
function useTypewriter(lines: string[], paused: boolean) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(reduce ? lines[0] : '');
  useEffect(() => {
    if (reduce || paused) return;
    let line = 0, i = 0, erasing = false, t = 0;
    const tick = () => {
      const full = lines[line];
      if (!erasing) {
        i++; setText(full.slice(0, i));
        if (i >= full.length) { erasing = true; t = window.setTimeout(tick, 1800); return; }
        t = window.setTimeout(tick, 34 + Math.random() * 40);
      } else {
        i -= 2; setText(full.slice(0, Math.max(0, i)));
        if (i <= 0) { erasing = false; line = (line + 1) % lines.length; t = window.setTimeout(tick, 320); return; }
        t = window.setTimeout(tick, 14);
      }
    };
    t = window.setTimeout(tick, 700);
    return () => window.clearTimeout(t);
  }, [lines, paused, reduce]);
  return text;
}

const AskBar: React.FC<{ onAsk: (q: string) => void; light?: boolean; placeholder?: string; autoType?: boolean; value?: string; onChange?: (v: string) => void }> = ({ onAsk, placeholder = 'Ask anything', autoType, value, onChange }) => {
  const [own, setOwn] = useState('');
  const [focused, setFocused] = useState(false);
  const v = value ?? own;
  const set = onChange ?? setOwn;
  const typed = useTypewriter(PROMPTS, !autoType || focused || v.length > 0);
  return (
    <form className="jk-ask" onSubmit={(e) => { e.preventDefault(); onAsk(v || typed); }}>
      <KawayanMark className="jk-ask__icon" size={18} />
      <label className="sr-only" htmlFor={autoType ? 'jk-ask-hero' : 'jk-ask-try'}>Ask Kawayan</label>
      <input id={autoType ? 'jk-ask-hero' : 'jk-ask-try'} value={v} onChange={(e) => set(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={autoType && !focused ? '' : placeholder} autoComplete="off" />
      {autoType && !v && !focused && <span className="jk-ask__ghost" aria-hidden="true">{typed}<i className="jk-caret" /></span>}
      <button type="submit" aria-label="Send"><ArrowUp aria-hidden="true" /></button>
    </form>
  );
};

/* ── hero 3D: a glowing floor and a slow ring of post cards ── */
const Hero3D: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty('--mx', String((e.clientX / window.innerWidth - 0.5) * 2));
      el.style.setProperty('--my', String((e.clientY / window.innerHeight - 0.5) * 2));
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
  return (
    <div ref={ref} className="jk-h3d" aria-hidden="true">
      <div className="jk-h3d__glow" />
      <div className="jk-h3d__floor" />
      <div className="jk-h3d__scene">
        <div className="jk-h3d__ring">
          {POSTS.map((s, i) => (
            <div key={s.key} className="jk-h3d__card" style={{ transform: `rotateY(${(360 / POSTS.length) * i}deg) translateZ(var(--r))` }}>
              <img src={shot(s, 1)} alt="" />
              <span>{s.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── shared bits for the pinned steps ── */
const Typed: React.FC<{ p: MotionValue<number>; from: number; to: number; text: string }> = ({ p, from, to, text }) => {
  const n = useTransform(p, [from, to], [0, text.length]);
  const s = useTransform(n, (v) => text.slice(0, Math.round(v)));
  return <motion.span>{s}</motion.span>;
};

/* Step 1: Brand DNA — a tilted form with voice chips floating at different depths */
const DnaPanel: React.FC<{ p: MotionValue<number> }> = ({ p }) => {
  const ry = useTransform(p, [0, 1], [-28, -10]);
  const pick = useTransform(p, [0.45, 0.55], [0, 1]);
  return (
    <div className="jk-3d">
      <motion.div className="jk-obj jk-form" style={{ rotateY: ry, rotateX: 12 }}>
        <div className="jk-form__row"><span>Business type</span><b><Typed p={p} from={0.05} to={0.2} text="Panaderia" /></b></div>
        <div className="jk-form__row"><span>What you sell</span><b><Typed p={p} from={0.2} to={0.4} text="Pandesal, ube ensaymada" /></b></div>
        <div className="jk-form__row"><span>Voice</span>
          <b className="jk-form__voice"><motion.i style={{ opacity: pick }} />Friendly Tita</b></div>
        <p className="jk-form__sample">"<Typed p={p} from={0.55} to={0.95} text="Mga anak, kumain na ba kayo? May bagong luto dito sa amin!" />"</p>
        {['Taglish', 'Families nearby', 'Promos', 'Holidays'].map((c, i) => (
          <span key={c} className="jk-float" style={{ ['--i' as string]: i }}>{c}</span>
        ))}
      </motion.div>
    </div>
  );
};

/* Step 2: Verify — a document on a tilt, a scan beam, then the stamp */
const VerifyPanel: React.FC<{ p: MotionValue<number> }> = ({ p }) => {
  const ry = useTransform(p, [0, 0.6], [24, 4]);
  const scan = useTransform(p, [0.1, 0.6], ['0%', '100%']);
  const scanOp = useTransform(p, [0.08, 0.12, 0.58, 0.62], [0, 1, 1, 0]);
  const stamp = useTransform(p, [0.62, 0.72], [2, 1]);
  const stampOp = useTransform(p, [0.62, 0.68], [0, 1]);
  return (
    <div className="jk-3d">
      <motion.div className="jk-obj jk-doc" style={{ rotateY: ry, rotateX: 14 }}>
        <span className="jk-doc__small">REPUBLIC OF THE PHILIPPINES · DTI</span>
        <b>Certificate of Business Name Registration</b>
        <span className="jk-doc__name">PANADERIA NI ALING ROSA</span>
        <i /><i style={{ width: '80%' }} /><i style={{ width: '62%' }} />
        <span className="jk-doc__small">Sample document</span>
        <motion.span className="jk-scan" style={{ top: scan, opacity: scanOp }} />
        <motion.span className="jk-stamp" style={{ scale: stamp, opacity: stampOp }}><BadgeCheck aria-hidden="true" />Verified</motion.span>
      </motion.div>
    </div>
  );
};

/* Step 3: Plan — an isometric month where post tiles rise up out of the grid */
const PLAN_DAYS = [1, 3, 5, 7, 10, 12, 15, 18, 21, 24, 27, 30];
const Tile: React.FC<{ p: MotionValue<number>; at: number; hot: boolean }> = ({ p, at, hot }) => {
  const z = useTransform(p, [at, at + 0.06], [0, hot ? 34 : 20]);
  const op = useTransform(p, [at, at + 0.04], [0, 1]);
  return <motion.span className={`jk-tile${hot ? ' is-hot' : ''}`} style={{ z, opacity: op }} />;
};
const PlanPanel: React.FC<{ p: MotionValue<number> }> = ({ p }) => {
  const rz = useTransform(p, [0, 1], [-42, -30]);
  return (
    <div className="jk-3d">
      <motion.div className="jk-obj jk-iso" style={{ rotateX: 56, rotateZ: rz }}>
        {Array.from({ length: 35 }).map((_, i) => {
          const day = i + 1;
          const k = PLAN_DAYS.indexOf(day);
          return (
            <div key={i} className={`jk-cell${day > 30 ? ' is-out' : ''}`}>
              {k > -1 && <Tile p={p} at={0.08 + k * 0.065} hot={day === 15 || day === 30 || day === 1} />}
            </div>
          );
        })}
      </motion.div>
      <div className="jk-legend"><span><i className="is-hot" />Payday · Undas</span><span><i />Post</span></div>
    </div>
  );
};

/* Step 4: Write — three caption versions fan out in depth; the front one types and scores */
const WritePanel: React.FC<{ p: MotionValue<number> }> = ({ p }) => {
  const spread = useTransform(p, [0, 0.4], [0, 1]);
  const back = useTransform(spread, (v) => `translate3d(${v * 70}px, ${-v * 34}px, ${-v * 140}px) rotateY(-18deg)`);
  const mid = useTransform(spread, (v) => `translate3d(${v * 36}px, ${-v * 18}px, ${-v * 70}px) rotateY(-18deg)`);
  const front = 'translate3d(0,0,0) rotateY(-18deg)';
  const score = useTransform(p, [0.6, 0.85], [0, 88]);
  const scoreTxt = useTransform(score, (v) => Math.round(v));
  const ring = useTransform(score, (v) => v / 100);
  const scoreOp = useTransform(p, (v) => Math.min(1, Math.max(0, (v - 0.55) / 0.05)));
  return (
    <div className="jk-3d">
      <div className="jk-fan">
        <motion.div className="jk-obj jk-card jk-card--ghost" style={{ transform: back }}><small>Version 1</small></motion.div>
        <motion.div className="jk-obj jk-card jk-card--ghost" style={{ transform: mid }}><small>Version 2</small></motion.div>
        <div className="jk-obj jk-card" style={{ transform: front }}>
          <small>Version 3 · Nov 15, 8:00 AM</small>
          <p><Typed p={p} from={0.2} to={0.6} text="Sweldo na, bes! 10% off sa lahat ng tinapay ngayong kinsenas. Agahan, mabilis maubos!" /></p>
          <img src="/hero/ai/panaderia-2.jpg" alt="" />
          <motion.div className="jk-score" style={{ opacity: scoreOp }}>
            <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" className="jk-score__bg" /><motion.circle cx="18" cy="18" r="15" className="jk-score__fg" style={{ pathLength: ring }} /></svg>
            <span><b><motion.span>{scoreTxt}</motion.span></b> reach score</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

/* Step 5: Post — a phone turns to face you, reach bars rise behind it */
const Bar: React.FC<{ p: MotionValue<number>; at: number; h: number }> = ({ p, at, h }) => {
  const scaleY = useTransform(p, [at, at + 0.15], [0, 1]);
  return <motion.i style={{ height: `${h}%`, scaleY, originY: 1 }} />;
};
const PostPanel: React.FC<{ p: MotionValue<number> }> = ({ p }) => {
  const ry = useTransform(p, [0, 0.45], [-38, -8]);
  const posted = useTransform(p, [0.4, 0.48], [0, 1]);
  const likes = useTransform(p, [0.5, 0.95], [0, 128]);
  const likesTxt = useTransform(likes, (v) => Math.round(v));
  return (
    <div className="jk-3d">
      <div className="jk-bars" aria-hidden="true">
        {[34, 48, 40, 62, 56, 78, 92].map((h, i) => <Bar key={i} p={p} at={0.45 + i * 0.05} h={h} />)}
      </div>
      <motion.div className="jk-obj jk-phone" style={{ rotateY: ry, rotateX: 6 }}>
        <div className="jk-phone__top">facebook</div>
        <div className="jk-phone__post">
          <div className="jk-phone__who"><span>P</span><b>Panaderia ni Aling Rosa</b></div>
          <p>Sweldo na, bes! 10% off sa lahat ng tinapay ngayong kinsenas.</p>
          <img src="/hero/ai/panaderia-2.jpg" alt="" />
          <div className="jk-phone__react"><Heart aria-hidden="true" /><motion.span>{likesTxt}</motion.span><MessageCircle aria-hidden="true" /><Send aria-hidden="true" /></div>
        </div>
        <motion.div className="jk-posted" style={{ opacity: posted }}><Check aria-hidden="true" />Posted to Facebook and Instagram</motion.div>
      </motion.div>
    </div>
  );
};

type Feature = { icon: React.ElementType; title: string; body: string };
const STEPS: { name: string; title: string; body: string; Panel: React.FC<{ p: MotionValue<number> }>; features: Feature[] }[] = [
  {
    name: 'Brand DNA', title: 'It learns how your shop talks', body: 'Answer a few questions once. Every caption after that sounds like you, not like a robot.', Panel: DnaPanel,
    features: [
      { icon: Store, title: 'Made for your kind of shop', body: 'Panaderia, sari-sari, salon or hardware: it knows what your customers care about.' },
      { icon: Mic, title: 'Five voices, or your own', body: 'Professional, makulit, hugot, minimalist or Friendly Tita. Or describe yours.' },
      { icon: Languages, title: 'Taglish, English, Filipino', body: 'Pick the language your suki actually use.' },
      { icon: Users, title: 'Written for your audience', body: 'Families nearby, office workers, students: captions speak to them.' },
    ],
  },
  {
    name: 'Verification', title: 'Real businesses, checked by people', body: 'Upload your Mayor\'s Permit, DTI or SEC document. A person on our team reviews it, usually within a day.', Panel: VerifyPanel,
    features: [
      { icon: FileSearch, title: 'Checked by hand', body: 'Name, owner and expiry are matched by a real reviewer.' },
      { icon: ShieldCheck, title: 'Kept private', body: 'Your permit is stored privately and only the review team can open it.' },
      { icon: Clock, title: 'Usually within a day', body: 'You can set up your Brand DNA while you wait.' },
      { icon: BadgeCheck, title: 'Live status', body: 'The page updates the moment you are approved.' },
    ],
  },
  {
    name: 'Month planner', title: 'A whole month in one click', body: 'Kawayan reads the Filipino calendar and puts posts on the days that matter: paydays, Undas, Bonifacio Day.', Panel: PlanPanel,
    features: [
      { icon: CalendarRange, title: 'Knows kinsenas and katapusan', body: 'Promos land on the 15th and 30th, when people have money.' },
      { icon: Target, title: 'Holidays built in', body: 'Undas, Christmas, Rizal Day and local moments, already on the calendar.' },
      { icon: CalendarRange, title: 'Up to 16 posts at once', body: 'Captions and images for the whole month, ready to review.' },
      { icon: Repeat2, title: 'Drag to move', body: 'Change any day by dragging the post on the calendar.' },
    ],
  },
  {
    name: 'Post studio', title: 'Captions and images, written for you', body: 'Every post gets a matching image and a reach score. Don\'t like it? Ask for a version that\'s shorter, more makulit or more Taglish.', Panel: WritePanel,
    features: [
      { icon: PenLine, title: 'Three versions per post', body: 'Regenerate twice and keep the one you like best.' },
      { icon: BarChart3, title: 'Reach score on every draft', body: 'A 0–100 score with one line on why, before anything goes out.' },
      { icon: ImagePlus, title: 'Images made to match', body: 'Or upload your own photo instead.' },
      { icon: Languages, title: 'Quick tweaks', body: 'Shorter, more playful, fresh hashtags, add a call to action.' },
    ],
  },
  {
    name: 'Publish & learn', title: 'Approve once, and it posts on time', body: 'Nothing goes out until you say so. Then Kawayan publishes to your Facebook Page and Instagram, and shows you what worked.', Panel: PostPanel,
    features: [
      { icon: Send, title: 'Facebook and Instagram', body: 'Connect once in Settings. Kawayan posts at the time you pick.' },
      { icon: Check, title: 'You approve every post', body: 'Nothing is published without your say.' },
      { icon: BarChart3, title: 'See what works', body: 'Reach, interactions and the best time to post.' },
      { icon: Clock, title: 'Even while you sleep', body: 'Your 6 AM pandesal post goes out at 6 AM.' },
    ],
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const StepLayer: React.FC<{ p: MotionValue<number>; i: number; n: number; children: (local: MotionValue<number>) => React.ReactNode; className: string }> = ({ p, i, n, children, className }) => {
  const a = i / n, b = (i + 1) / n, e = 0.02;
  // Plain functions, not range arrays: Motion hands range-array transforms of scroll progress to the
  // browser's ScrollTimeline, which mapped these fades wrong (step 1 faded back in under later steps).
  const opacity = useTransform(p, (v) => {
    const fadeIn = i === 0 ? 1 : clamp01((v - (a - e)) / (2 * e));
    const fadeOut = i === n - 1 ? 1 : clamp01(((b + e) - v) / (2 * e));
    return Math.min(fadeIn, fadeOut);
  });
  const local = useTransform(p, (v) => clamp01((v - a) / (b - a)));
  const pointer = useTransform(opacity, (v) => (v > 0.5 ? 'auto' : 'none'));
  return <motion.div className={className} style={{ opacity, pointerEvents: pointer }}>{children(local)}</motion.div>;
};

const Steps: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const one = useMotionValue(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  useEffect(() => scrollYProgress.on('change', (v) => setActive(Math.min(STEPS.length - 1, Math.floor(v * STEPS.length)))), [scrollYProgress]);
  const n = STEPS.length;

  if (reduce) {
    return (
      <section id="steps" className="jk-steps jk-steps--static" data-story-dark="">
        {STEPS.map((s) => (
          <div key={s.name} className="jk-grid">
            <div className="jk-copy"><h2>{s.title}</h2><p>{s.body}</p></div>
            <div className="jk-right"><div className="jk-panel"><s.Panel p={one} /></div><Features list={s.features} /></div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section ref={ref} id="steps" className="jk-steps" style={{ height: `${n * 110}vh` }} data-story-dark="">
      <div className="jk-sticky">
        <div className="jk-grid">
          <div className="jk-copy">
            <div className="jk-stack">
              {STEPS.map((s, i) => (
                <StepLayer key={s.name} p={scrollYProgress} i={i} n={n} className="jk-layer">
                  {() => (<><h2>{s.title}</h2><p>{s.body}</p>
                    <a href="/signup" className="jk-btn">Get started<ArrowRight aria-hidden="true" /></a></>)}
                </StepLayer>
              ))}
            </div>
            <ol className="jk-progress" aria-label="Steps">
              {STEPS.map((s, i) => <li key={s.name} className={i === active ? 'is-on' : i < active ? 'is-done' : ''}><span>{s.name}</span></li>)}
            </ol>
          </div>
          <div className="jk-right">
            <div className="jk-panel">
              {STEPS.map((s, i) => (
                <StepLayer key={s.name} p={scrollYProgress} i={i} n={n} className="jk-layer jk-layer--panel">
                  {(local) => <s.Panel p={local} />}
                </StepLayer>
              ))}
            </div>
            <div className="jk-stack jk-stack--features">
              {STEPS.map((s, i) => (
                <StepLayer key={s.name} p={scrollYProgress} i={i} n={n} className="jk-layer">
                  {() => <Features list={s.features} />}
                </StepLayer>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Features: React.FC<{ list: Feature[] }> = ({ list }) => (
  <div className="jk-features">
    {list.map(({ icon: Icon, title, body }) => (
      <div key={title}><h3><Icon aria-hidden="true" />{title}</h3><p>{body}</p></div>
    ))}
  </div>
);

/* ── Try it: type your shop, see a sample post (prewritten samples, no AI call) ── */
const ALIASES: [RegExp, string][] = [
  [/bake|bread|pandesal|panad/i, 'panaderia'], [/milk ?tea|boba|tea/i, 'milktea'], [/sari|tindahan|store|grocery/i, 'sarisari'],
  [/carinderia|karinderya|ulam|eatery|kusina/i, 'carinderia'], [/coffee|kape|cafe|barako/i, 'coffee'], [/ukay|thrift|clothes|damit|boutique/i, 'ukay'],
  [/barber|gupit|haircut/i, 'barbershop'], [/plant|halaman|garden/i, 'plants'], [/lechon|manok|chicken|grill/i, 'lechon'],
  [/salon|beauty|nail|rebond|parlor/i, 'salon'], [/hardware|ferreteria|construction|yero/i, 'hardware'], [/kakanin|bibingka|puto|delicac/i, 'kakanin'],
];
const findShop = (q: string): Shop | null => {
  const hit = ALIASES.find(([re]) => re.test(q));
  return hit ? SHOPS.find((s) => s.key === hit[1]) ?? null : null;
};
function useTypeOnce(text: string) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState('');
  useEffect(() => {
    if (reduce) { setOut(text); return; }
    setOut('');
    let i = 0;
    const id = window.setInterval(() => { i++; setOut(text.slice(0, i)); if (i >= text.length) window.clearInterval(id); }, 22);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return out;
}
const TryIt: React.FC<{ q: string; setQ: (v: string) => void; shop: Shop | null; miss: boolean; run: (t: string) => void }> = ({ q, setQ, shop, miss, run }) => {
  const caption = useTypeOnce(shop?.caption ?? '');
  return (
    <section id="try" className="jk-try" data-story-dark="">
      <h2>What kind of shop do you have?</h2>
      <p>Type it in any language and see the kind of post Kawayan writes for it.</p>
      <AskBar onAsk={run} value={q} onChange={setQ} placeholder="e.g. milk tea kiosk sa Cebu, o kaya tindahan" />
      <div className="jk-chips">{['Bakery', 'Milk tea', 'Barbershop', 'Ukay', 'Salon', 'Hardware'].map((s) => <button key={s} type="button" onClick={() => { setQ(s); run(s); }}>{s}</button>)}</div>
      <div className="jk-try__out" aria-live="polite">
        {shop && (
          <article className="jk-try__post" key={shop.key}>
            <div className="jk-phone__who"><span>{shop.name.charAt(0)}</span><b>{shop.name}</b><small>{shop.type} · sample</small></div>
            <p>{caption}<i className="jk-caret" /></p>
            <img src={shot(shop, 1)} alt={`Sample post image for a ${shop.type}`} />
            <a href="/signup" className="jk-btn">Get 8 posts like this free<ArrowRight aria-hidden="true" /></a>
          </article>
        )}
        {miss && <p className="jk-try__miss">No sample for that yet, but Kawayan writes for any shop. <a href="/signup">Try it with yours</a>.</p>}
      </div>
    </section>
  );
};

const HowItWorksStory: React.FC = () => {
  const [q, setQ] = useState('');
  const [shop, setShop] = useState<Shop | null>(null);
  const [miss, setMiss] = useState(false);
  const run = (t: string) => { const s = findShop(t); setShop(s); setMiss(!s && t.trim().length > 0); };
  const askFromHero = (t: string) => { setQ(t); run(t); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }); };

  useEffect(() => { document.title = 'How Kawayan works'; }, []);

  return (
    <div className="jk">
      <header className="jk-bar">
        <a href="/" className="jk-bar__brand" aria-label="Kawayan home"><KawayanLogo size={17} onDark /></a>
        <nav className="jk-bar__nav" aria-label="Page">
          <a href="#steps">How it works</a><a href="#try">Try it</a><a href="/">Homepage</a>
        </nav>
        <a href="/signup" className="jk-btn jk-btn--sm">Get started</a>
      </header>

      <section className="jk-hero" data-story-dark="">
        <Hero3D />
        <div className="jk-hero__in">
          <span className="jk-pill"><i />Social media autopilot for Filipino shops</span>
          <h1>The helper that plans, writes and <em>posts</em> for your shop.</h1>
          <AskBar onAsk={askFromHero} autoType />
          <div className="jk-chips">{['Panaderia', 'Milk tea', 'Sari-sari', 'Carinderia'].map((s) => <button key={s} type="button" onClick={() => askFromHero(s)}>{s}</button>)}</div>
        </div>
        <a href="#steps" className="jk-scroll">Scroll to see how<span /></a>
      </section>

      <Steps />
      <TryIt q={q} setQ={setQ} shop={shop} miss={miss} run={run} />

      <section className="jk-end" data-story-dark="">
        <h2>Your month, on <em>autopilot</em>.</h2>
        <p>Free for 8 posts a month. No credit card.</p>
        <div className="jk-end__actions"><a href="/signup" className="jk-btn">Start free trial<ArrowRight aria-hidden="true" /></a><a href="/" className="jk-btn jk-btn--ghost">Back to homepage</a></div>
      </section>
    </div>
  );
};

export default HowItWorksStory;
