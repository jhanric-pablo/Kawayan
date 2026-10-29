import React from 'react';
import { Heart, MessageCircle, Repeat2, CalendarCheck, Sparkles, TrendingUp } from 'lucide-react';

/**
 * Animated, on-brand hero backdrop for the landing page.
 * Pure CSS/SVG — no video, no external assets — so it always matches the
 * Kawayan design system (forest green + sage) and the product's theme:
 * social media content running on autopilot.
 *
 * Renders once. Mouse/scroll parallax is applied by the parent to the
 * wrapping layer, so this component never needs to re-render.
 */
interface CardConfig {
  top: string;
  left?: string;
  right?: string;
  width: number;
  delay: number;
  duration: number;
  rot: number;
  kind: 'image' | 'video' | 'carousel';
  likes: string;
  comments: string;
  scheduled?: boolean;
  trending?: boolean;
}

// Left-weighted "feed" column — the right edge belongs to the business-type marquee.
const CARDS: CardConfig[] = [
  { top: '9%', left: '3%', width: 236, delay: 0, duration: 13, rot: -2, kind: 'image', likes: '2.4k', comments: '188', scheduled: true },
  { top: '39%', left: '7%', width: 204, delay: -5, duration: 16, rot: 1.5, kind: 'carousel', likes: '910', comments: '64', trending: true },
  { top: '67%', left: '4%', width: 220, delay: -9, duration: 15, rot: -1.5, kind: 'video', likes: '5.1k', comments: '402', scheduled: true },
  { top: '20%', left: '30%', width: 168, delay: -11, duration: 18, rot: 1, kind: 'image', likes: '3.3k', comments: '210', trending: true },
];

const RISERS = [
  { left: '12%', delay: 0, duration: 8, icon: 'heart' },
  { left: '24%', delay: -3, duration: 10, icon: 'chat' },
  { left: '40%', delay: -6, duration: 9, icon: 'heart' },
  { left: '54%', delay: -1.5, duration: 11, icon: 'repeat' },
];

const kindLabel = (k: CardConfig['kind']) =>
  k === 'video' ? 'Reel' : k === 'carousel' ? 'Carousel' : 'Post';

const HeroBackground: React.FC = () => (
  <div className="kw-hero-bg absolute inset-0 overflow-hidden">
    <style>{`
      .kw-hero-bg {
        background:
          radial-gradient(120% 90% at 15% 0%, rgba(43,87,72,0.55), transparent 60%),
          radial-gradient(120% 90% at 100% 100%, rgba(156,176,128,0.28), transparent 55%),
          linear-gradient(160deg, #0d1c17 0%, #10241d 45%, #0a1512 100%);
      }
      .kw-hero-orb { position: absolute; border-radius: 9999px; filter: blur(60px); opacity: 0.5; will-change: transform; }
      .kw-hero-orb--1 { width: 44vw; height: 44vw; left: -8vw; top: -12vw;
        background: radial-gradient(circle, rgba(58,115,98,0.75), transparent 70%);
        animation: kw-orb-1 26s ease-in-out infinite; }
      .kw-hero-orb--2 { width: 38vw; height: 38vw; right: -6vw; bottom: -10vw;
        background: radial-gradient(circle, rgba(156,176,128,0.5), transparent 70%);
        animation: kw-orb-2 32s ease-in-out infinite; }
      .kw-hero-orb--3 { width: 26vw; height: 26vw; left: 40%; top: 30%;
        background: radial-gradient(circle, rgba(43,87,72,0.7), transparent 70%);
        animation: kw-orb-3 24s ease-in-out infinite; }
      @keyframes kw-orb-1 { 0%,100%{ transform: translate3d(0,0,0) scale(1); } 50%{ transform: translate3d(6%,4%,0) scale(1.12); } }
      @keyframes kw-orb-2 { 0%,100%{ transform: translate3d(0,0,0) scale(1.05); } 50%{ transform: translate3d(-5%,-6%,0) scale(0.92); } }
      @keyframes kw-orb-3 { 0%,100%{ transform: translate3d(0,0,0) scale(1); } 50%{ transform: translate3d(-8%,5%,0) scale(1.15); } }

      .kw-hero-grid {
        position: absolute; inset: -2px;
        background-image:
          linear-gradient(rgba(156,176,128,0.09) 1px, transparent 1px),
          linear-gradient(90deg, rgba(156,176,128,0.09) 1px, transparent 1px);
        background-size: 64px 64px;
        -webkit-mask-image: radial-gradient(120% 90% at 50% 20%, #000 20%, transparent 75%);
        mask-image: radial-gradient(120% 90% at 50% 20%, #000 20%, transparent 75%);
        animation: kw-grid-pan 40s linear infinite;
      }
      @keyframes kw-grid-pan { 0%{ background-position: 0 0, 0 0; } 100%{ background-position: 64px 64px, 64px 64px; } }

      .kw-hero-card {
        position: absolute; will-change: transform;
        border-radius: 20px; padding: 12px;
        background: linear-gradient(150deg, rgba(20,42,34,0.72), rgba(12,26,21,0.6));
        border: 1px solid rgba(156,176,128,0.22);
        box-shadow: 0 24px 60px -18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        animation: kw-card-float var(--dur,14s) ease-in-out infinite;
        animation-delay: var(--delay,0s);
      }
      @keyframes kw-card-float {
        0%,100%{ transform: translateY(0) rotate(var(--rot,0deg)); }
        50%{ transform: translateY(-16px) rotate(calc(var(--rot,0deg) * -1)); }
      }
      .kw-hero-card__media {
        height: 88px; border-radius: 12px; margin: 8px 0;
        background:
          radial-gradient(circle at 72% 28%, rgba(156,176,128,0.35), transparent 60%),
          linear-gradient(135deg, rgba(43,87,72,0.55), rgba(12,26,21,0.5));
        display: flex; align-items: center; justify-content: center;
        border: 1px solid rgba(156,176,128,0.14);
      }
      .kw-hero-bar { height: 7px; border-radius: 9999px; background: rgba(200,214,190,0.28); }
      .kw-hero-pill {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        padding: 3px 7px; border-radius: 9999px;
      }
      .kw-hero-riser {
        position: absolute; bottom: 8%; will-change: transform, opacity; opacity: 0;
        animation: kw-rise var(--dur,9s) ease-in infinite; animation-delay: var(--delay,0s);
      }
      @keyframes kw-rise {
        0%{ transform: translateY(0) scale(0.7); opacity: 0; }
        15%{ opacity: 0.9; }
        70%{ opacity: 0.7; }
        100%{ transform: translateY(-44vh) scale(1.05); opacity: 0; }
      }
      .kw-hero-bamboo {
        position: absolute; top: 0; bottom: 0; width: 3px; border-radius: 9999px;
        background: linear-gradient(to bottom, transparent, rgba(156,176,128,0.32) 20%, rgba(156,176,128,0.32) 80%, transparent);
      }
      .kw-hero-bamboo::before, .kw-hero-bamboo::after {
        content: ''; position: absolute; left: -3px; width: 9px; height: 9px; border-radius: 3px;
        background: rgba(156,176,128,0.4);
      }
      .kw-hero-bamboo::before { top: 34%; }
      .kw-hero-bamboo::after { top: 66%; }

      @media (prefers-reduced-motion: reduce) {
        .kw-hero-orb, .kw-hero-grid, .kw-hero-card, .kw-hero-riser { animation: none !important; }
        .kw-hero-riser { opacity: 0.45; }
      }
    `}</style>

    <div className="kw-hero-orb kw-hero-orb--1" />
    <div className="kw-hero-orb kw-hero-orb--2" />
    <div className="kw-hero-orb kw-hero-orb--3" />
    <div className="kw-hero-grid" />

    {/* Bamboo motif — a nod to "Kawayan" */}
    <div className="kw-hero-bamboo" style={{ left: '4%' }} />
    <div className="kw-hero-bamboo" style={{ right: '4%' }} />

    {/* Floating social posts */}
    {CARDS.map((c, i) => (
      <div
        key={i}
        className="kw-hero-card hidden sm:block"
        style={{
          top: c.top,
          left: c.left,
          right: c.right,
          width: c.width,
          ['--dur' as string]: `${c.duration}s`,
          ['--delay' as string]: `${c.delay}s`,
          ['--rot' as string]: `${c.rot}deg`,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #9CB080, #2B5748)' }} />
          <div className="flex-1 space-y-1.5">
            <div className="kw-hero-bar" style={{ width: '62%' }} />
            <div className="kw-hero-bar" style={{ width: '40%', opacity: 0.6 }} />
          </div>
          {c.scheduled && (
            <span className="kw-hero-pill" style={{ background: 'rgba(156,176,128,0.16)', color: '#C5D9BB' }}>
              <CalendarCheck className="w-2.5 h-2.5" /> Auto
            </span>
          )}
        </div>

        <div className="kw-hero-card__media">
          <span className="kw-hero-pill" style={{ background: 'rgba(12,26,21,0.55)', color: '#C5D9BB' }}>
            <Sparkles className="w-2.5 h-2.5" /> {kindLabel(c.kind)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'rgba(197,217,187,0.85)' }}>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" style={{ color: '#9CB080' }} /> {c.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {c.comments}</span>
          <Repeat2 className="w-3 h-3 opacity-70" />
          {c.trending && (
            <span className="ml-auto flex items-center gap-1" style={{ color: '#9CB080' }}>
              <TrendingUp className="w-3 h-3" /> Trending
            </span>
          )}
        </div>
      </div>
    ))}

    {/* Rising engagement */}
    {RISERS.map((r, i) => (
      <div
        key={i}
        className="kw-hero-riser hidden sm:block"
        style={{ left: r.left, ['--dur' as string]: `${r.duration}s`, ['--delay' as string]: `${r.delay}s` }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 34, height: 34, background: 'rgba(20,42,34,0.7)', border: '1px solid rgba(156,176,128,0.3)' }}
        >
          {r.icon === 'heart' && <Heart className="w-4 h-4" style={{ color: '#9CB080' }} />}
          {r.icon === 'chat' && <MessageCircle className="w-4 h-4" style={{ color: '#C5D9BB' }} />}
          {r.icon === 'repeat' && <Repeat2 className="w-4 h-4" style={{ color: '#C5D9BB' }} />}
        </div>
      </div>
    ))}
  </div>
);

export default React.memo(HeroBackground);
