import React, { useEffect, useRef, useState } from 'react';
import { ViewState } from '../types';
import {
  ArrowRight, Sparkles, Calendar, Zap, CheckCircle2,
  Wand2, Share2, Store, Heart, MessageCircle, Send, Bookmark, Loader2,
} from 'lucide-react';
import HeroBackground from './landing/HeroBackground';
import WhyKawayan from './landing/WhyKawayan';
import './landing/landing.css';

interface Props {
  onNavigate: (view: ViewState) => void;
}

// Showcases the variety of Philippine MSMEs Kawayan AI serves — scrolls beside the hero.
const BUSINESS_TYPES = [
  'Coffee Shop', 'Sari-sari Store', 'Milk Tea Kiosk', 'Panaderia', 'Carinderia',
  'Ukay Boutique', 'Barbershop', 'Hardware Store', 'Lechon Manok Stall', 'Beauty Salon',
  'Frozen Goods Reseller', 'Halamanan / Plant Shop', 'Native Delicacies', 'Print & Layout Shop',
  'Motoparts Supply', 'Poultry Farm',
];

const STEPS = [
  { icon: Store, title: 'Tell us your brand', desc: 'Four quick questions — your name, audience, voice, and the topics you post about.' },
  { icon: Wand2, title: 'AI plans your month', desc: 'One click turns that into a full calendar of Taglish captions with matching visuals.' },
  { icon: Share2, title: 'Preview & publish', desc: 'See exactly how each post looks on Facebook, Instagram, and TikTok — then post.' },
];

const QUOTES = [
  { text: 'Dati, gabi-gabi akong nag-iisip ng caption. Ngayon isang click — buong linggo ng posts, Taglish pa, parang sarili kong pananalita.', name: 'Rosa D.', role: 'Panaderia owner · Bulacan', av: 'RD' },
  { text: 'Yung calendar view lang, sulit na. Nakikita ko agad kung anong araw walang laman, tapos AI na bahala mag-draft.', name: 'Kevin M.', role: 'Milk tea kiosk · Cebu', av: 'KM' },
  { text: 'Nag-post ako sa Facebook, Instagram, at TikTok in one sitting. Yung preview mukhang totoong post na agad.', name: 'Aisa T.', role: 'Ukay boutique · Davao', av: 'AT' },
];

const FAQS = [
  { q: 'Do I need a credit card to start?', a: 'No. The free plan gives you 8 AI posts every month, the full content calendar, and Taglish captions plus visuals — no card required.' },
  { q: 'Which platforms does Kawayan support?', a: 'Facebook, Instagram, and TikTok. The composer shows a live, platform-accurate preview for each one before you publish.' },
  { q: 'Is the AI actually good at Taglish?', a: 'It is tuned for Filipino business culture — hugot, diskarte, and everyday Taglish — not a literal English-to-Tagalog translation.' },
  { q: 'Can I edit what the AI writes?', a: 'Always. Every caption, hashtag, and image prompt is fully editable, and you can upload your own photo to replace the AI visual.' },
  { q: 'What happens when I run out of posts?', a: 'Add single posts anytime for ₱150 each, or upgrade to Pro (₱499/mo) for 16 posts, analytics, and priority generation.' },
];

const PLANS = [
  {
    name: 'Free Trial', tag: 'For trying it out', price: '₱0', unit: 'forever', cta: 'Start free', featured: false,
    features: ['8 AI posts per month', 'Taglish captions + visuals', 'Content calendar & agenda', '1 business profile'],
  },
  {
    name: 'Pro', tag: 'For growing shops', price: '₱499', unit: 'per month', cta: 'Get Pro', featured: true,
    features: ['Everything in Free, plus…', '16 AI posts per month', 'Growth analytics dashboard', 'Priority AI generation', 'CSV exports'],
  },
  {
    name: 'Enterprise', tag: 'For chains & agencies', price: 'Custom', unit: 'talk to us', cta: 'Contact us', featured: false,
    features: ['Everything in Pro, plus…', 'Unlimited content planning', 'Multiple business profiles', 'Dedicated support & onboarding'],
  },
];

/* ── Hero product console: a self-playing "social automation" demo ── */
type ChipStatus = 'idea' | 'draft' | 'scheduled' | 'published';
const CAL_LABEL: Record<ChipStatus, string> = { idea: 'Idea', draft: 'Draft', scheduled: 'Sched', published: 'Live' };
const CAL_START_DOW = 3;
const CAL_DAYS = 30;
const CAL_TODAY = 8;
const AMBIENT_CHIPS: Record<number, ChipStatus> = { 3: 'published', 8: 'scheduled', 22: 'draft' };
const DEMO_DAYS = [5, 12, 19, 26];
const FOCUS_DAY = 12;
const DEMO_CAPTION =
  'Tag-ulan na naman, bes! ☔ Best time for hot choco — yakap in a cup. Come thru! ☕ #BedWeather';
const DEMO_PLATFORMS = ['Instagram', 'Facebook', 'TikTok'] as const;
const LOOP_MS = 17000;
const PUB_START = 10300;
const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* Stylised "generated photo" scenes — inline SVG so there are no external
   requests; the demo cycles through them, one per loop. */
const photoSVG = (
  bg: [string, string, string], liquid: string, glass: string, w: number, h: number, rim: number,
) => {
  const cx = 220;
  const top = 178 - h / 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 440 330'>
<defs>
<radialGradient id='bg' cx='30%' cy='24%' r='105%'>
<stop offset='0' stop-color='${bg[0]}'/><stop offset='.52' stop-color='${bg[1]}'/><stop offset='1' stop-color='${bg[2]}'/>
</radialGradient>
<linearGradient id='gl' x1='0' y1='0' x2='.35' y2='1'>
<stop offset='0' stop-color='#fff' stop-opacity='.92'/><stop offset='.5' stop-color='${glass}' stop-opacity='.5'/><stop offset='1' stop-color='${glass}' stop-opacity='.82'/>
</linearGradient>
<filter id='sf' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='10'/></filter>
<filter id='gr'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/></filter>
</defs>
<rect width='440' height='330' fill='url(#bg)'/>
<circle cx='374' cy='54' r='54' fill='#fff' opacity='.15' filter='url(#sf)'/>
<circle cx='52' cy='264' r='70' fill='${liquid}' opacity='.24' filter='url(#sf)'/>
<ellipse cx='${cx}' cy='280' rx='130' ry='23' fill='#000' opacity='.32' filter='url(#sf)'/>
<rect x='${cx - w / 2}' y='${top}' width='${w}' height='${h}' rx='${rim}' fill='url(#gl)'/>
<ellipse cx='${cx}' cy='${top}' rx='${w / 2}' ry='${w / 6.5}' fill='${liquid}'/>
<ellipse cx='${cx}' cy='${top}' rx='${w / 2.6}' ry='${w / 8.5}' fill='#000' opacity='.2'/>
<rect x='${cx - w / 2 + 9}' y='${top + 13}' width='${w * 0.2}' height='${h * 0.7}' rx='${rim / 1.6}' fill='#fff' opacity='.42'/>
<rect width='440' height='330' filter='url(#gr)'/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const DEMO_PHOTOS = [
  photoSVG(['#f1ddc0', '#cfa06a', '#7c5330'], '#3b2512', '#efe6d6', 140, 150, 20), // hot coffee
  photoSVG(['#e3eded', '#b3cbc4', '#5a7b72'], '#2a4b40', '#e9f1ee', 116, 182, 16), // iced latte
  photoSVG(['#f7e6bd', '#e6bd77', '#a87c34'], '#5c3e14', '#f6ecd6', 150, 128, 30), // milk tea
  photoSVG(['#f2d9dd', '#d79aa6', '#8f5563'], '#5a2c38', '#f5e6ea', 128, 156, 22), // pink drink
];

/* Number that counts up when it scrolls into view */
const CountUp: React.FC<{ to: number; dur?: number; prefix?: string; suffix?: string; sep?: boolean }> = ({
  to, dur = 1500, prefix = '', suffix = '', sep = false,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting || done.current) return;
      done.current = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        setN(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step); else setN(to);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, dur]);
  const val = Math.round(n);
  return <span ref={ref}>{prefix}{sep ? val.toLocaleString() : val}{suffix}</span>;
};

const HeroConsole: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(PREFERS_REDUCED ? 16000 : 0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const prevT = useRef(0);

  useEffect(() => {
    if (PREFERS_REDUCED) return;
    let onScreen = true;
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; }, { threshold: 0.04 })
        : null;
    if (io && rootRef.current) io.observe(rootRef.current);
    const id = window.setInterval(() => {
      if (document.hidden || !onScreen) return;
      setT((x) => (x + 40) % LOOP_MS);
    }, 40);
    return () => { window.clearInterval(id); io?.disconnect(); };
  }, []);

  // Rotate to a fresh "generated photo" whenever the loop restarts.
  useEffect(() => {
    if (prevT.current > LOOP_MS - 600 && t < 600) {
      setPhotoIdx((i) => (i + 1) % DEMO_PHOTOS.length);
    }
    prevT.current = t;
  }, [t]);
  const photo = DEMO_PHOTOS[photoIdx];

  // ── phase + derived state, all a pure function of the loop clock ──
  const phase: 'plan' | 'write' | 'visual' | 'publish' | 'done' =
    t < 3400 ? 'plan' : t < 7500 ? 'write' : t < PUB_START ? 'visual' : t < 15600 ? 'publish' : 'done';

  const planP = clamp01((t - 200) / 2900);
  const chipsIn = t < 250 ? 0 : Math.min(DEMO_DAYS.length, Math.ceil(planP * DEMO_DAYS.length));

  const writeP = clamp01((t - 3500) / 3600);
  const typed = Math.round(writeP * DEMO_CAPTION.length);

  const imgP = clamp01((t - 7400) / 1800);
  const showShimmer = phase === 'write' || (phase === 'visual' && imgP < 1);

  const slot = t < PUB_START ? -1 : Math.floor((t - PUB_START) / 1500);
  const inSlot = t < PUB_START ? 0 : (t - PUB_START) % 1500;
  const activeP = t < PUB_START ? 0 : Math.min(2, Math.max(0, slot));
  const posted = new Set<number>();
  if (t >= PUB_START) {
    for (let i = 0; i < Math.min(3, slot); i++) posted.add(i);
    if (slot >= 0 && slot < 3 && inSlot > 620) posted.add(slot);
    if (slot >= 3) { posted.add(0); posted.add(1); posted.add(2); }
  }

  const focusStatus: ChipStatus = t < PUB_START ? 'idea' : t < 12400 ? 'scheduled' : 'published';

  const engP = clamp01((t - PUB_START) / 4800);
  const likes = t < PUB_START ? 0 : Math.round(engP * 236) + 7;
  const comments = t < PUB_START ? 0 : Math.round(engP * 24);

  const status =
    phase === 'plan' ? 'Planning September…'
      : phase === 'write' ? 'Writing your caption…'
        : phase === 'visual' ? 'Generating the visual…'
          : phase === 'publish' ? `Publishing to ${DEMO_PLATFORMS[activeP]}…`
            : '4 posts scheduled · 3 platforms';
  const busy = phase !== 'done';

  const cardFade = t > LOOP_MS - 480 ? clamp01((LOOP_MS - t) / 380) : t < 340 ? clamp01(t / 300) : 1;

  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - CAL_START_DOW + 1;
    const inMonth = day >= 1 && day <= CAL_DAYS;
    const label = inMonth ? day : day < 1 ? 30 + day : day - CAL_DAYS;
    return { key: i, day, label, inMonth, today: inMonth && day === CAL_TODAY };
  });

  return (
    <div ref={rootRef}>
      <div className="lp-console__badge lp-console__badge--tl" data-on={chipsIn >= DEMO_DAYS.length}>
        <Sparkles className="w-3.5 h-3.5" /> AI drafted 4 posts
      </div>
      <div className="lp-console__badge lp-console__badge--br" data-on={posted.size >= 3}>
        <CheckCircle2 className="w-3.5 h-3.5" /> Scheduled to 3 platforms
      </div>

      <div className="lp-console__bar">
        <span className="lp-console__dot" /><span className="lp-console__dot" /><span className="lp-console__dot" />
        <span className="lp-console__title">Kawayan · Content Studio</span>
        <span className={`lp-console__status${busy ? ' is-busy' : ''}`}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          <span>{status}</span>
        </span>
      </div>

      <div className="lp-console__body" style={{ opacity: cardFade }}>
        <div className="lp-cal">
          <div className="lp-cal__head">
            <span className="lp-cal__month">September 2026</span>
            <span className="lp-cal__nav"><span>‹</span><span>›</span></span>
          </div>
          <div className="lp-cal__dows">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="lp-cal__dow">{d}</span>)}
          </div>
          <div className="lp-cal__grid">
            <div
              className="lp-cal__scan"
              style={{ top: `${planP * 100}%`, opacity: phase === 'plan' && t > 160 ? 1 : 0 }}
            />
            {cells.map((c) => {
              const demoIdx = DEMO_DAYS.indexOf(c.day);
              const showDemo = demoIdx > -1 && demoIdx < chipsIn;
              const ambient = !showDemo && c.inMonth ? AMBIENT_CHIPS[c.day] : undefined;
              const st = showDemo ? (c.day === FOCUS_DAY ? focusStatus : 'idea') : ambient;
              return (
                <div
                  key={c.key}
                  className={
                    'lp-cal__cell'
                    + (c.inMonth ? '' : ' lp-cal__cell--out')
                    + (c.today ? ' lp-cal__cell--today' : '')
                    + (c.day === FOCUS_DAY && phase !== 'plan' ? ' lp-cal__cell--focus' : '')
                  }
                >
                  {c.label}
                  {st && <span key={st} className={`lp-cal__chip lp-cal__chip--${st}`}>{CAL_LABEL[st]}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lp-pv">
          <div className="lp-pv__tabs">
            {DEMO_PLATFORMS.map((p, i) => (
              <span
                key={p}
                className={`lp-pv__tab lp-pv__tab--${p.toLowerCase()}${(t >= PUB_START ? activeP === i : i === 0) ? ' is-active' : ''}`}
              >
                {p}
              </span>
            ))}
          </div>
          <div className="lp-pv__card">
            <div className="lp-pv__head">
              <span className="lp-pv__avatar" />
              <div className="lp-pv__meta">
                <span className="lp-pv__name">Kapehan sa Kanto</span>
                <span className="lp-pv__sub">Sponsored · Kawayan AI</span>
              </div>
            </div>

            <div className="lp-pv__media">
              {phase === 'plan' ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <>
                  <div
                    className="lp-pv__photo"
                    style={{
                      backgroundImage: `url("${photo}")`,
                      opacity: Math.min(1, imgP * 1.3),
                      transform: `scale(${1.08 - imgP * 0.08})`,
                    }}
                  />
                  {showShimmer && <div className="lp-pv__shimmer" style={{ opacity: 1 - imgP }} />}
                </>
              )}
              <span className="lp-pv__stamp" data-shown={posted.has(activeP)}>Posted</span>
            </div>

            <div className="lp-pv__acts">
              <Heart className="w-4 h-4" /><span className="lp-pv__count">{likes || ''}</span>
              <MessageCircle className="w-4 h-4" /><span className="lp-pv__count">{comments || ''}</span>
              <Send className="w-4 h-4" />
              <Bookmark className="w-4 h-4 ml-auto" />
            </div>

            <div className="lp-pv__body">
              {phase === 'plan' ? (
                <span className="lp-pv__caption lp-pv__caption--ph">Your Taglish caption will appear here…</span>
              ) : (
                <span className="lp-pv__caption">
                  {DEMO_CAPTION.slice(0, typed)}
                  {writeP < 1 && <span className="lp-pv__caret" />}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetScrollY = useRef(0);
  const currentScrollY = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // --- Smooth scroll scrub + layered parallax ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parallaxNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));

    // Cache each parallax layer's document-space centre (transform-independent),
    // so the per-frame math never feeds back on itself.
    let bases: number[] = [];
    const measure = () => {
      bases = parallaxNodes.map((n) => {
        const prev = n.style.transform;
        n.style.transform = 'none';
        const r = n.getBoundingClientRect();
        n.style.transform = prev;
        return r.top + window.scrollY + r.height / 2;
      });
    };
    measure();
    const remeasure = window.setTimeout(measure, 1100);
    window.addEventListener('resize', measure);

    const handleScroll = () => { targetScrollY.current = window.scrollY; };

    const smoothUpdate = () => {
      currentScrollY.current += (targetScrollY.current - currentScrollY.current) * 0.08;

      const containerTop = container.offsetTop;
      const scrollRange = window.innerHeight * 2;
      const progress = Math.min(1, Math.max(0, (currentScrollY.current - containerTop) / scrollRange));
      const eased = progress * (2 - progress);
      const opacity = Math.max(0, 1 - eased * 1.5);
      const scale = 1 - eased * 0.05;
      const { x: mx, y: my } = mouseRef.current;

      if (contentRef.current) {
        contentRef.current.style.opacity = opacity.toString();
        contentRef.current.style.transform = `translate3d(${mx * -14}px, ${my * -14}px, 0) scale(${scale})`;
        contentRef.current.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
      }
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(${mx * 18}px, ${my * 18 - progress * 60}px, 0) scale(${1.05 + progress * 0.12})`;
        bgRef.current.style.opacity = (1 - progress * 0.6).toString();
      }
      if (overlayRef.current) overlayRef.current.style.opacity = (0.7 + (1 - opacity) * 0.3).toString();
      if (indicatorRef.current) indicatorRef.current.style.opacity = (1 - progress * 4).toString();

      if (!reduce) {
        if (consoleRef.current) {
          const r = consoleRef.current.getBoundingClientRect();
          const off = (r.top + r.height / 2) - window.innerHeight / 2;
          // Only ever nudge the console DOWN while it is still below the fold,
          // easing to its resting spot as you scroll to it — never lift it up
          // into the hero text/buttons.
          const rise = Math.max(0, Math.min(56, off * 0.05));
          consoleRef.current.style.transform =
            `perspective(1600px) translate3d(0, ${rise.toFixed(1)}px, 0) rotateX(${(my * 1.4).toFixed(2)}deg) rotateY(${(mx * -1.8).toFixed(2)}deg)`;
        }
        const sy = window.scrollY;
        const mid = window.innerHeight / 2;
        parallaxNodes.forEach((n, i) => {
          const speed = parseFloat(n.dataset.parallax || '0');
          const o = (bases[i] - sy) - mid;
          n.style.transform = `translate3d(0, ${(-o * speed).toFixed(1)}px, 0)`;
        });
      }

      requestRef.current = requestAnimationFrame(smoothUpdate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    requestRef.current = requestAnimationFrame(smoothUpdate);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', measure);
      window.clearTimeout(remeasure);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- Scroll reveal ---
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleParallaxMove = (e: React.MouseEvent) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    mouseRef.current = { x: (e.clientX - cx) / cx, y: (e.clientY - cy) / cy };
  };

  // Click the product console → dim + blur the rest of the page and lift/zoom it.
  // Click again, click the backdrop, or press Escape to exit.
  const [consoleFocus, setConsoleFocus] = useState(false);
  const consoleFocusEnabled = !PREFERS_REDUCED;
  const toggleConsoleFocus = () => {
    if (consoleFocusEnabled) setConsoleFocus((v) => !v);
  };

  useEffect(() => {
    if (!consoleFocus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConsoleFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [consoleFocus]);

  return (
    <div
      className="flex flex-col relative bg-white dark:bg-slate-900 transition-colors overflow-x-hidden"
      onMouseMove={handleParallaxMove}
    >
      {/* ══ Hero ══ */}
      <div ref={containerRef} className="relative bg-[#0a1512] z-0">
        <section
          className="sticky top-0 h-screen w-full flex items-center overflow-hidden z-10 transform-gpu"
          style={{ willChange: 'transform' }}
        >
          <div
            ref={bgRef}
            className="absolute inset-0 -z-20 pointer-events-none transform-gpu"
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0) scale(1.05)' }}
          >
            <HeroBackground />
          </div>

          <div ref={overlayRef} className="absolute inset-0 -z-10 transition-opacity duration-700">
            <div className="absolute inset-0 bg-[#0B1714]/45 dark:bg-[#060F0D]/60" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(43,87,72,0.4) 0%, rgba(26,61,48,0.42) 45%, rgba(11,23,20,0.72) 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(19,58,48,0.2) 0%, rgba(11,23,20,0) 35%, rgba(8,16,13,0.62) 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 50% 40%, transparent 36%, rgba(5,12,10,0.62) 100%)' }} />
          </div>

          <div className="absolute bottom-0 left-0 w-full h-44 bg-gradient-to-t from-white dark:from-slate-900 to-transparent z-20" />

          {/* Vertical business-type marquee */}
          <div className="absolute right-3 sm:right-6 lg:right-10 top-0 bottom-0 z-20 hidden lg:flex items-center pointer-events-none">
            <div
              className="relative h-[70vh] overflow-hidden"
              style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)' }}
            >
              <div className="flex flex-col items-end gap-3 animate-scroll-y">
                {[...BUSINESS_TYPES, ...BUSINESS_TYPES].map((biz, i) => (
                  <div key={i} className="flex w-max items-center gap-2.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-2.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#9CB080' }} />
                    <span className="text-[11px] lg:text-xs font-semibold uppercase tracking-[0.14em] text-white/80 whitespace-nowrap">{biz}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div ref={indicatorRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/40 animate-bounce transition-opacity duration-500">
            <span className="text-[9px] font-bold uppercase tracking-[0.25em]">Scroll to explore</span>
            <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, #9CB080, transparent)' }} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-20">
            <div ref={contentRef} className="max-w-3xl mx-auto text-center transition-transform duration-100 ease-out">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/85 border border-white/15 bg-white/[0.07] backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9CB080] animate-pulse-dot" />
                For every Filipino MSME
              </span>

              <h1
                className="font-display font-bold text-[3.25rem] sm:text-7xl lg:text-8xl text-white mb-7 leading-[0.94] tracking-[-0.035em]"
                style={{ filter: 'drop-shadow(0 4px 30px rgba(0,0,0,0.85))' }}
              >
                Social Media <br />
                <span style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(115deg, #E4EFD9, #9CB080 55%, #6FAE8C)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                  On Autopilot.
                </span>
              </h1>

              <p
                className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto mb-10 leading-relaxed font-medium"
                style={{ filter: 'drop-shadow(0 2px 14px rgba(0,0,0,0.9))' }}
              >
                AI that understands Taglish and Filipino business culture—so you can create captions, visuals, and schedules with confidence.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => onNavigate(ViewState.SIGNUP)}
                  className="group/btn relative px-8 py-4 rounded-full font-bold text-[0.95rem] overflow-hidden w-full sm:w-auto hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                  style={{ background: '#FFFFFF', color: '#15352A', boxShadow: '0 12px 34px -10px rgba(0,0,0,0.5)' }}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    Start Free Trial <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </span>
                </button>
                <a
                  href="#how"
                  className="px-6 py-4 rounded-full font-semibold text-[0.95rem] text-white/85 border border-white/20 bg-white/[0.06] backdrop-blur-md hover:bg-white/[0.12] hover:text-white transition-all w-full sm:w-auto text-center"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm font-medium text-white/65">
                Create your first 7-day content calendar in minutes. No credit card required.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ══ Hero product console (parallax rise, overlaps hero) ══ */}
      {consoleFocus && (
        <div
          className="lp-console-backdrop"
          onClick={() => setConsoleFocus(false)}
        />
      )}
      <div
        className={`lp-console-wrap${consoleFocus ? ' is-focused' : ''}${consoleFocusEnabled ? ' is-interactive' : ''}`}
        onClick={consoleFocusEnabled ? toggleConsoleFocus : undefined}
        onKeyDown={
          consoleFocusEnabled
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleConsoleFocus();
                }
              }
            : undefined
        }
        role={consoleFocusEnabled ? 'button' : undefined}
        tabIndex={consoleFocusEnabled ? 0 : undefined}
        aria-pressed={consoleFocusEnabled ? consoleFocus : undefined}
        aria-label={
          consoleFocusEnabled
            ? consoleFocus
              ? 'Exit product preview zoom'
              : 'Zoom in on the product preview'
            : undefined
        }
      >
        <div className="lp-console-glow" data-parallax="0.06" />
        <div ref={consoleRef} className="lp-console reveal reveal--scale" style={{ willChange: 'transform' }}>
          <HeroConsole />
        </div>
      </div>

      {/* ══ Stats band ══ */}
      <section className="relative z-10 bg-white dark:bg-slate-900 pt-16 sm:pt-20 pb-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lp-stats reveal">
            <div className="lp-stat">
              <p className="lp-stat__num"><CountUp to={20} suffix="+" /><span> hrs</span></p>
              <p className="lp-stat__label">saved on content each week</p>
            </div>
            <div className="lp-stat">
              <p className="lp-stat__num"><CountUp to={1000} suffix="+" sep /></p>
              <p className="lp-stat__label">Filipino MSMEs onboard</p>
            </div>
            <div className="lp-stat">
              <p className="lp-stat__num"><CountUp to={3} /></p>
              <p className="lp-stat__label">platforms — FB, IG &amp; TikTok</p>
            </div>
            <div className="lp-stat">
              <p className="lp-stat__num">₱<CountUp to={0} /></p>
              <p className="lp-stat__label">to start — free forever plan</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Logos marquee ══ */}
      <div className="w-full bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-7 overflow-hidden relative z-10">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10" />
        <p className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600 z-20 pointer-events-none">Trusted by</p>
        <div className="flex w-[200%] animate-scroll">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-around w-1/2 items-center gap-16 px-16 min-w-max">
              <span className="text-xl font-black text-slate-300 dark:text-slate-700 tracking-tight">KAIN<span style={{ color: '#2B5748' }}>.</span>PO</span>
              <span className="text-xl font-light italic text-slate-300 dark:text-slate-700">ManilaStrut</span>
              <span className="text-xl font-bold tracking-[0.2em] text-slate-300 dark:text-slate-700">BARAKO</span>
              <span className="text-xl font-mono text-slate-300 dark:text-slate-700">TechTito</span>
              <span className="text-xl font-semibold text-slate-300 dark:text-slate-700">Lola&apos;s<span className="font-light">Best</span></span>
              <span className="text-xl font-black text-slate-300 dark:text-slate-700" style={{ letterSpacing: '0.08em' }}>DISKARTE<span style={{ color: '#2B5748' }}>!</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ How it works ══ */}
      <section id="how" className="relative z-10 bg-slate-50 dark:bg-slate-900 py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--green w-[520px] h-[520px] -left-40 top-10" data-parallax="0.08" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-16 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> How it works</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-[-0.025em]">
              From blank calendar to a month of posts.
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">Three steps. No design skills, no marketing degree.</p>
          </div>

          <div className="lp-steps">
            <div className="lp-steps__line" />
            {STEPS.map((s, i) => (
              <div key={s.title} className={`lp-step reveal reveal-d${i + 1}`}>
                <div className="lp-step__badge">
                  <s.icon className="w-6 h-6" />
                  <span className="lp-step__n">{i + 1}</span>
                </div>
                <h3 className="lp-step__title">{s.title}</h3>
                <p className="lp-step__desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Features bento ══ */}
      <section id="features" className="relative z-10 bg-white dark:bg-slate-900 py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--sage w-[460px] h-[460px] -right-40 top-1/3" data-parallax="0.1" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Built for Filipino MSMEs</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-[-0.025em]">Master the algorithm.</h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">Native Filipino AI understanding. No more robotic translations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-4 sm:gap-5 h-auto md:h-[620px]">
            <div className="md:col-span-2 row-span-2 bg-white dark:bg-slate-850 rounded-[1.75rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-400 reveal reveal--scale">
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl -mr-20 -mt-20 opacity-[0.12] group-hover:opacity-20 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, #2B5748, transparent)' }} />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#2B5748', boxShadow: '0 8px 22px -8px rgba(43,87,72,0.5)' }}>
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-3 tracking-[-0.02em]">Taglish Magic</h3>
                  <p className="text-base text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                    Our AI doesn&apos;t just translate; it understands culture. It generates &quot;hugot&quot;, &quot;diskarte&quot;, and &quot;sweldo&quot; humor that resonates deeply with Pinoy audiences.
                  </p>
                </div>
                <div className="mt-8 bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 w-full max-w-md self-center transform group-hover:scale-[1.02] transition-transform duration-500">
                  <div className="flex gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-600 dark:text-slate-300">
                      Create a caption for a rainy day coffee promo.
                    </div>
                  </div>
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#2B5748' }}>AI</div>
                    <div className="p-3 rounded-2xl rounded-tr-none text-sm font-medium" style={{ background: 'rgba(43, 87, 72,0.1)', color: '#2B5748' }}>
                      &quot;Tag-ulan na naman! ☔️ Perfect time para mag-emote with our Hot Choco. Yakap in a cup, bes! ☕️ #BedWeather&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-white rounded-[1.75rem] p-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-400 reveal reveal--scale reveal-d1" style={{ background: '#15352A' }}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-12 -mt-12 opacity-25 group-hover:opacity-40 transition-opacity" style={{ background: '#9CB080' }} />
              <div className="dot-pattern-dark absolute inset-0 rounded-[1.75rem] opacity-50" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-3 tracking-[-0.02em]">Trend Riding</h3>
                <p className="text-white/55 text-sm leading-relaxed">Real-time alerts on what&apos;s trending in Manila. Never miss a viral wave.</p>
                <div className="mt-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: '#9CB080' }} />
                  <span className="text-xs font-semibold" style={{ color: '#C2D6B6' }}>Live trend tracking</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 rounded-[1.75rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm group hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-400 reveal reveal--scale reveal-d2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 bg-[#2B5748]/10 border border-[#2B5748]/20">
                <Calendar className="w-5 h-5" style={{ color: '#2B5748' }} />
              </div>
              <h3 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2 tracking-[-0.02em]">Auto-Calendar</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-5 leading-relaxed">Plan 30 days of content in 1 click. Drag, drop, done.</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < 4 ? '' : 'bg-slate-200 dark:bg-slate-700'}`} style={i < 4 ? { background: '#2B5748' } : {}} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Testimonials ══ */}
      <section className="relative z-10 bg-slate-50 dark:bg-slate-900 py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--green w-[500px] h-[500px] left-[calc(50%-250px)] -top-24" data-parallax="0.07" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Diskarte, delivered</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-[-0.025em]">
              Loved by shop owners nationwide.
            </h2>
          </div>
          <div className="lp-quotes">
            {QUOTES.map((q, i) => (
              <div key={q.name} className={`lp-quote reveal reveal-d${i + 1}`}>
                <span className="lp-quote__mark">“</span>
                <p className="lp-quote__text">{q.text}</p>
                <div className="lp-quote__who">
                  <span className="lp-quote__av">{q.av}</span>
                  <div>
                    <p className="lp-quote__name">{q.name}</p>
                    <p className="lp-quote__role">{q.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Why Kawayan — the meaning behind the name ══ */}
      <WhyKawayan />

      {/* ══ Pricing ══ */}
      <section id="pricing" className="relative z-10 bg-white dark:bg-slate-900 py-28 sm:py-32 border-t border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="lp-blob lp-blob--sage w-[440px] h-[440px] -left-32 bottom-10" data-parallax="0.09" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Simple pricing</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-[-0.025em]">
              Priced for a sari-sari&nbsp;budget.
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">Start free. Upgrade when your shop is ready. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {PLANS.map((plan, idx) => (
              <div
                key={plan.name}
                className={`relative rounded-[1.5rem] p-7 flex flex-col transition-all duration-300 reveal reveal--scale reveal-d${idx + 1} ${
                  plan.featured
                    ? 'lp-glow-border text-white shadow-xl md:-translate-y-3 border border-white/10'
                    : 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700'
                }`}
                style={plan.featured ? { background: '#15352A' } : undefined}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.13em] bg-[#9CB080] text-[#15352A] z-10">Recommended</span>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${plan.featured ? 'text-[#C2D6B6]' : 'text-[#2B5748] dark:text-[#9CB080]'}`}>{plan.tag}</span>
                <h3 className={`font-display font-bold text-2xl mt-1.5 mb-4 tracking-[-0.02em] ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className={`font-display font-bold text-4xl tracking-[-0.02em] ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.featured ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>{plan.unit}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.featured ? 'text-white/75' : 'text-slate-600 dark:text-slate-300'}`}>
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? 'text-[#9CB080]' : 'text-[#2B5748] dark:text-[#9CB080]'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate(ViewState.SIGNUP)}
                  className={`w-full py-3.5 rounded-full font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                    plan.featured ? 'bg-[#9CB080] text-[#15352A] hover:bg-[#C2D6B6]' : 'bg-[#2B5748] text-white hover:bg-[#37715A]'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-12 reveal">
            Need a few extra posts? Add single posts anytime for{' '}
            <span className="font-semibold text-[#2B5748] dark:text-[#9CB080]">₱150 each</span>.
            All prices in PHP · No credit card required for the free trial.
          </p>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="relative z-10 bg-slate-50 dark:bg-slate-900 py-28 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Questions</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 leading-[1.08] tracking-[-0.025em]">
              Everything else, answered.
            </h2>
          </div>
          <div className="lp-faq reveal">
            {FAQS.map((f) => (
              <details key={f.q} className="lp-faq__item">
                <summary className="lp-faq__q">{f.q}</summary>
                <p className="lp-faq__a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Final CTA ══ */}
      <section id="free-plan" className="py-32 sm:py-36 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: '#0F231C' }} />
        <div className="absolute inset-0 dot-pattern-dark opacity-100" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25" style={{ background: '#2B5748' }} data-parallax="0.05" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15" style={{ background: '#9CB080' }} data-parallax="0.08" />

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10 reveal">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ background: 'rgba(156,176,128,0.12)', color: '#FFFFFF', border: '1px solid rgba(156,176,128,0.28)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#9CB080] animate-pulse-dot" />
            1,000+ Filipino MSMEs and counting
          </span>
          <h2 className="font-display font-bold text-5xl md:text-7xl text-white mb-6 leading-[1.02] tracking-[-0.035em]">
            Ready to go <span style={{ color: '#C2D6B6' }}>Viral?</span>
          </h2>
          <p className="text-lg text-white/55 mb-12 max-w-xl mx-auto leading-relaxed">
            Save 20 hours a week on content creation. AI-powered Taglish captions, auto-scheduling, and live trend alerts.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => onNavigate(ViewState.SIGNUP)}
              className="group px-10 py-4 rounded-full font-bold text-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
              style={{ background: '#FFFFFF', color: '#15352A', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.5)' }}
            >
              Get Started Free <ArrowRight className="inline-block w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm font-medium text-white/45">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#9CB080' }} /> No credit card required</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#9CB080' }} /> Cancel anytime</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: '#9CB080' }} /> Free plan available</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
