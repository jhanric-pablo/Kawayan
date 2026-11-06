import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ViewState } from '../types';
import {
  ArrowRight, CheckCircle2,
  ShieldCheck, Lock, UserCheck,
} from 'lucide-react';
import HeroShowcase from './landing/HeroShowcase';
// Below the fold: loaded after the hero so the first paint is lighter.
const WhyKawayan = lazy(() => import('./landing/WhyKawayan'));
const HowItWorks = lazy(() => import('./landing/HowItWorks'));
const Features = lazy(() => import('./landing/Features'));
/** Holds the section's space while it loads, so the page doesn't jump. */
const SectionSkeleton: React.FC<{ h: number }> = ({ h }) => <div className="kw-skel rounded-xl" style={{ height: h }} aria-hidden />;
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

/** One full-width band on the ruled page: a centred 1152px column with side rails and "+" marks. */
const Band: React.FC<{ id?: string; className?: string; railClassName?: string; marks?: boolean; label?: string; children: React.ReactNode }> = ({
  id, className = '', railClassName = '', marks = true, label, children,
}) => (
  <section id={id} className={`lp-band ${className}`} aria-label={label}>
    <div className={`lp-rail ${railClassName}`}>
      {children}
      {marks && (<><i className="lp-px lp-px--l" aria-hidden="true" /><i className="lp-px lp-px--r" aria-hidden="true" /></>)}
    </div>
  </section>
);

/** Dashed spacer row between sections. */
const Spacer: React.FC = () => (
  <div className="lp-band" aria-hidden="true"><div className="lp-rail"><div className="lp-spacer" /></div></div>
);

const SectionTitle: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }> = ({ title, sub, action }) => (
  <div className="lp-sec-title reveal">
    <div>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
    {action}
  </div>
);

const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  // --- Scroll reveal (opacity + transform only) ---
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.isIntersecting) { e.target.classList.add('is-in'); io?.unobserve(e.target); }
          }
        }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })
      : null;
    // Lazy sections mount after this effect runs, so keep picking up new .reveal elements.
    const watch = () => root.querySelectorAll('.reveal:not(.is-in)').forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); io?.disconnect(); };
  }, []);

  // FAQ answers expand/collapse independently (not an exclusive accordion).
  const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());

  return (
    <div className="lp-page" ref={pageRef}>
      {/* ══ Hero ══ */}
      <Band className="lp-band--hero" railClassName="lp-hero" label="Introduction">
        <HeroShowcase onNavigate={onNavigate} />
      </Band>

      <Spacer />

      {/* ══ Stats ══ */}
      <Band label="Kawayan in numbers">
        <div className="lp-stats reveal">
          <div className="lp-stat">
            <p className="lp-stat__num"><CountUp to={20} suffix="+" /><span className="lp-stat__unit"> hrs</span></p>
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
      </Band>

      {/* ══ Trusted by ══ */}
      <Band railClassName="lp-logos" label="Trusted by">
        <p className="lp-logos__label">Trusted by</p>
        <div className="lp-logos__row">
          <span className="font-semibold tracking-tight">KAIN<span className="lp-logos__dot">.</span>PO</span>
          <span className="italic">ManilaStrut</span>
          <span className="font-semibold tracking-[0.2em]">BARAKO</span>
          <span className="mono">TechTito</span>
          <span className="font-semibold">Lola&apos;s<span className="font-normal">Best</span></span>
          <span className="font-semibold tracking-[0.08em]">DISKARTE<span className="lp-logos__dot">!</span></span>
        </div>
      </Band>

      <Spacer />

      {/* ══ Why Kawayan — the meaning behind the name (animation unchanged) ══ */}
      <div className="lp-band lp-band--why" data-nav-dark>
        <div className="lp-rail">
          <Suspense fallback={<SectionSkeleton h={420} />}><WhyKawayan /></Suspense>
          <i className="lp-px lp-px--l" aria-hidden="true" /><i className="lp-px lp-px--r" aria-hidden="true" />
        </div>
      </div>

      {/* ══ How it works ══ */}
      <Band id="how" railClassName="lp-pad">
        <SectionTitle title="From a blank calendar to a month of posts" sub="Three steps, and no design skills needed." />
        <Suspense fallback={<SectionSkeleton h={420} />}><HowItWorks /></Suspense>
      </Band>

      {/* ══ Features ══ */}
      <Band id="features" railClassName="lp-pad">
        <SectionTitle title="Everything you need to post every week" sub={<>The tools inside Kawayan, shown the way you&rsquo;ll use them.</>} />
        <Suspense fallback={<SectionSkeleton h={640} />}><Features /></Suspense>
      </Band>

      <Spacer />

      {/* ══ Testimonials ══ */}
      <Band railClassName="lp-pad" label="What shop owners say">
        <SectionTitle title="What owners said after trying it" />
        <div className="lp-quotes">
          {QUOTES.map((q, i) => (
            <figure key={q.name} className={`lp-quote reveal reveal-d${i + 1}`}>
              <blockquote className="lp-quote__text">“{q.text}”</blockquote>
              <figcaption className="lp-quote__who">
                <span className="lp-quote__av">{q.av}</span>
                <div>
                  <p className="lp-quote__name">{q.name}</p>
                  <p className="lp-quote__role">{q.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Band>

      {/* ══ Pricing ══ */}
      <Band id="pricing" railClassName="lp-pad">
        <SectionTitle title={<>Priced for a sari-sari&nbsp;budget</>} sub="Start free. Upgrade when your shop is ready. Cancel anytime." />
        <div className="lp-prices">
          {PLANS.map((plan, idx) => (
            <div key={plan.name} className={`lp-price reveal reveal-d${idx + 1}${plan.featured ? ' is-featured' : ''}`}>
              <div>
                <p className="lp-price__tag">{plan.tag}</p>
                <h3 className="lp-price__name">
                  {plan.name}
                  {plan.featured && <span className="badge badge-green">Recommended</span>}
                </h3>
              </div>
              <p className="lp-price__amt">{plan.price} <small>{plan.unit}</small></p>
              <ul className="lp-price__list">
                {plan.features.map((f) => (
                  <li key={f}><CheckCircle2 aria-hidden="true" />{f}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onNavigate(ViewState.SIGNUP)}
                className={`btn w-full ${plan.featured ? 'btn-primary' : 'btn-outline'}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="lp-price__note reveal">
          Need a few extra posts? Add single posts anytime for <b>₱150 each</b>.
          All prices in PHP · No credit card required for the free trial.
        </p>
      </Band>

      {/* ══ Trust strip ══ */}
      <Band railClassName="lp-trust-rail" label="Trust and safety">
        <div className="lp-trust reveal">
          {TRUST_ITEMS.map(({ Icon, label }) => (
            <div className="lp-trust__item" key={label}>
              <Icon className="lp-trust__icon" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Band>

      {/* ══ FAQ ══ */}
      <Band id="faq" railClassName="lp-pad">
        <div className="lp-faq-grid">
          <div className="reveal">
            <h2 className="lp-faq-grid__title">Questions owners ask</h2>
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
      </Band>

      {/* ══ Final CTA ══ */}
      <Band id="free-plan" railClassName="lp-cta" label="Get started">
        <div className="reveal">
          <span className="lp-cta__pill"><span className="lp-cta__dot" /> 1,000+ Filipino MSMEs and counting</span>
          <h2>Ready to go <em>Viral?</em></h2>
          <p>Save 20 hours a week on content creation. AI-powered Taglish captions, auto-scheduling, and live trend alerts.</p>
          <div className="lp-cta__actions">
            <button type="button" onClick={() => onNavigate(ViewState.SIGNUP)} className="btn btn-primary btn-lg">
              Get Started Free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="lp-cta__strip">
          <span aria-hidden="true" />
          <span><CheckCircle2 aria-hidden="true" /> No credit card required</span>
          <span><CheckCircle2 aria-hidden="true" /> Cancel anytime</span>
          <span><CheckCircle2 aria-hidden="true" /> Free plan available</span>
          <span aria-hidden="true" />
        </div>
      </Band>
    </div>
  );
};

export default LandingPage;
