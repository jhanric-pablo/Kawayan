import React, { useEffect, useRef, useState } from 'react';
import { ViewState } from '../types';
import {
  ArrowRight, CheckCircle2,
  ShieldCheck, Lock, UserCheck,
} from 'lucide-react';
import HeroShowcase from './landing/HeroShowcase';
import WhyKawayan from './landing/WhyKawayan';
import HowItWorks from './landing/HowItWorks';
import Features from './landing/Features';
import './landing/landing.css';

interface Props {
  onNavigate: (view: ViewState) => void;
}

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

const TRUST_ITEMS = [
  { Icon: Lock, label: 'Encrypted end-to-end' },
  { Icon: UserCheck, label: 'Manual business verification' },
  { Icon: ShieldCheck, label: 'PH-based, Taglish support' },
  { Icon: CheckCircle2, label: 'No credit card required' },
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

const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetScrollY = useRef(0);
  const currentScrollY = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
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
      // The pinned fade-out only makes sense on desktop, where the hero is sticky; phones scroll it normally.
      const progress = window.innerWidth < 1024 ? 0 : Math.min(1, Math.max(0, (currentScrollY.current - containerTop) / scrollRange));
      const eased = progress * (2 - progress);
      const opacity = Math.max(0, 1 - eased * 1.5);
      const scale = 1 - eased * 0.05;
      const { x: mx, y: my } = window.innerWidth < 1024 ? { x: 0, y: 0 } : mouseRef.current;

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

      if (!reduce) {
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

  // FAQ answers expand/collapse independently (not an exclusive accordion).
  const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());

  return (
    <div
      className="flex flex-col relative bg-background transition-colors overflow-x-hidden"
      onMouseMove={handleParallaxMove}
    >
      {/* ══ Hero ══ */}
      <div ref={containerRef} className="relative bg-emerald-900 z-0">
        <section
          className="relative lg:sticky lg:top-0 min-h-screen lg:h-screen w-full flex items-center overflow-hidden z-10 transform-gpu"
          style={{ willChange: 'transform' }}
        >
          <div
            ref={bgRef}
            className="absolute inset-0 -z-20 pointer-events-none transform-gpu"
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0) scale(1.05)' }}
          >
            <div className="lp-hs-bg" />
          </div>

          <div ref={overlayRef} className="absolute inset-0 -z-10 transition-opacity duration-700" style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(5,12,10,0.4) 100%)" }} />

          <div className="absolute bottom-0 left-0 w-full h-24 bg-linear-to-t from-background to-transparent z-10" />

          <div ref={contentRef} className="relative z-20 w-full transition-transform duration-100 ease-out">
            <HeroShowcase onNavigate={onNavigate} />
          </div>
        </section>
      </div>

      {/* ══ Stats band ══ */}
      <section className="relative z-10 bg-background pt-16 sm:pt-20 pb-6">
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
      <div className="w-full bg-background border-y border-slate-200 dark:border-slate-800 py-7 overflow-hidden relative z-10">
        <div className="absolute inset-y-0 left-0 w-32 bg-linear-to-r from-white dark:from-slate-900 to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-linear-to-l from-white dark:from-slate-900 to-transparent z-10" />
        <p className="eyebrow absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-slate-400 dark:text-slate-600 z-20 pointer-events-none">Trusted by</p>
        <div className="flex w-[200%] animate-scroll">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-around w-1/2 items-center gap-16 px-16 min-w-max">
              <span className="text-xl font-bold text-slate-300 dark:text-slate-700 tracking-tight">KAIN<span style={{ color: '#2B5748' }}>.</span>PO</span>
              <span className="text-xl font-normal italic text-slate-300 dark:text-slate-700">ManilaStrut</span>
              <span className="text-xl font-bold tracking-[0.2em] text-slate-300 dark:text-slate-700">BARAKO</span>
              <span className="text-xl font-mono text-slate-300 dark:text-slate-700">TechTito</span>
              <span className="text-xl font-semibold text-slate-300 dark:text-slate-700">Lola&apos;s<span className="font-normal">Best</span></span>
              <span className="text-xl font-bold text-slate-300 dark:text-slate-700" style={{ letterSpacing: '0.08em' }}>DISKARTE<span style={{ color: '#2B5748' }}>!</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Why Kawayan — the meaning behind the name (moved up: brand trust before the funnel) ══ */}
      <WhyKawayan />

      {/* ══ How it works ══ */}
      <section id="how" className="relative z-10 bg-(--bg-alt) py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--green w-[520px] h-[520px] -left-40 top-10" data-parallax="0.08" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-16 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> How it works</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-tight">
              From blank calendar to a month of posts.
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">Three steps. No design skills, no marketing degree.</p>
          </div>

          <HowItWorks />
        </div>
      </section>

      {/* ══ Features bento ══ */}
      <section id="features" className="relative z-10 bg-background py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--sage w-[460px] h-[460px] -right-40 top-1/3" data-parallax="0.1" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Features</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-tight">Post with confidence.</h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">The tools inside Kawayan, shown the way you&rsquo;ll use them.</p>
          </div>

          <Features />
        </div>
      </section>

      {/* ══ Testimonials ══ */}
      <section className="relative z-10 bg-(--bg-alt) py-28 sm:py-32 overflow-hidden">
        <div className="lp-blob lp-blob--green w-[500px] h-[500px] left-[calc(50%-250px)] -top-24" data-parallax="0.07" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Diskarte, delivered</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-tight">
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

      {/* ══ Pricing ══ */}
      <section id="pricing" className="relative z-10 bg-background py-28 sm:py-32 border-t border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="lp-blob lp-blob--sage w-[440px] h-[440px] -left-32 bottom-10" data-parallax="0.09" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Simple pricing</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 mb-4 leading-[1.08] tracking-tight">
              Priced for a sari-sari&nbsp;budget.
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">Start free. Upgrade when your shop is ready. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {PLANS.map((plan, idx) => (
              <div
                key={plan.name}
                className={`relative rounded-[1.5rem] p-7 flex flex-col transition duration-300 reveal reveal--scale reveal-d${idx + 1} ${
                  plan.featured
                    ? 'lp-glow-border text-white shadow-xl md:-translate-y-3 border border-white/10'
                    : 'bg-card border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700'
                }`}
                style={plan.featured ? { background: '#15352A' } : undefined}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-accent text-emerald-700 z-10">Recommended</span>
                )}
                <span className={`eyebrow ${plan.featured ? 'text-sage-200' : 'text-emerald-500 dark:text-accent'}`}>{plan.tag}</span>
                <h3 className={`font-display font-bold text-2xl mt-1.5 mb-4 tracking-[-0.02em] ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className={`font-display font-bold text-4xl tracking-[-0.02em] ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.featured ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>{plan.unit}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.featured ? 'text-white/75' : 'text-slate-600 dark:text-slate-300'}`}>
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? 'text-accent' : 'text-emerald-500 dark:text-accent'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate(ViewState.SIGNUP)}
                  className={`w-full py-3.5 rounded-full font-bold text-sm transition hover:-translate-y-0.5 active:translate-y-0 ${
                    plan.featured ? 'bg-accent text-emerald-700 hover:bg-sage-200' : 'bg-emerald-500 text-white hover:bg-primary-light'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-12 reveal">
            Need a few extra posts? Add single posts anytime for{' '}
            <span className="font-semibold text-emerald-500 dark:text-accent">₱150 each</span>.
            All prices in PHP · No credit card required for the free trial.
          </p>
        </div>
      </section>

      {/* ══ Trust strip ══ */}
      <section className="relative z-10 bg-background py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lp-trust reveal">
            {TRUST_ITEMS.map(({ Icon, label }) => (
              <div className="lp-trust__item" key={label}>
                <Icon className="lp-trust__icon" aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="relative z-10 bg-(--bg-alt) py-28 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 reveal">
            <span className="lp-eyebrow mb-5"><span className="lp-eyebrow__dot" /> Questions</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 dark:text-white mt-5 leading-[1.08] tracking-tight">
              Everything else, answered.
            </h2>
          </div>
          <div className="lp-faq reveal">
            {FAQS.map((f) => {
              const isOpen = openFaqs.has(f.q);
              return (
                <div key={f.q} className={`lp-faq__item${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="lp-faq__q"
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${f.q}`}
                    onClick={() => setOpenFaqs((prev) => {
                      const next = new Set(prev);
                      next.has(f.q) ? next.delete(f.q) : next.add(f.q);
                      return next;
                    })}
                  >
                    {f.q}
                  </button>
                  <div className="lp-faq__a-wrap" id={`faq-a-${f.q}`}>
                    <p className="lp-faq__a">{f.a}</p>
                  </div>
                </div>
              );
            })}
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
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 text-xs font-bold" style={{ background: 'rgba(156,176,128,0.12)', color: '#FFFFFF', border: '1px solid rgba(156,176,128,0.28)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
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
              className="group px-10 py-4 rounded-full font-bold text-lg hover:-translate-y-0.5 active:translate-y-0 transition"
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
