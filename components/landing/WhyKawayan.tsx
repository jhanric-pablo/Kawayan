import React from 'react';
import { Sprout, Radio } from 'lucide-react';
import WaveHandIcon from './WaveHandIcon';
import BambooGrowIcon from './BambooGrowIcon';

/**
 * Splits a string into per-word spans that fade + rise in sequence once an
 * ancestor with `.reveal` gains `.is-in` (scroll-reveal). `bold` marks word
 * indices that get the sage highlight. Word spacing is handled in CSS via
 * `.lp-anitext__w` margin so the markup stays plain.
 */
const AnimatedText: React.FC<{
  text: string;
  className?: string;
  base?: number;
  step?: number;
  bold?: number[];
}> = ({ text, className = '', base = 0, step = 0.045, bold = [] }) => {
  const words = text.split(' ');
  return (
    <span className={`lp-anitext ${className}`.trim()}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span
            key={i}
            className={`lp-anitext__w${bold.includes(i) ? ' is-b' : ''}`}
            style={{ transitionDelay: `${(base + i * step).toFixed(3)}s` } as React.CSSProperties}
          >
            {w}
          </span>
        ))}
      </span>
    </span>
  );
};

/**
 * "Why Kawayan AI?" — the story behind the name.
 * Kaway (to wave / welcome → connection) + Kawayan (bamboo → growth, resilience).
 * Everything animates on scroll-in: the headline word swings + underlines itself,
 * the copy assembles word-by-word, the wave ripples, and the bamboo grows and sways.
 */
const WhyKawayan: React.FC = () => (
  <section id="why" className="lp-why">
    <div className="lp-why__bg" aria-hidden="true">
      <span className="lp-blob lp-blob--green w-[560px] h-[560px] -left-40 -top-24" data-parallax="0.06" />
      <span className="lp-blob lp-blob--sage w-[460px] h-[460px] -right-32 -bottom-20" data-parallax="0.09" />
      <div className="lp-why__dots" />
      <svg className="lp-why__leaf lp-why__leaf--1" data-parallax="0.16" viewBox="0 0 40 12"><path d="M1 6C11 1 30 1 39 6C29 11 10 11 1 6Z" /></svg>
      <svg className="lp-why__leaf lp-why__leaf--2" data-parallax="0.24" viewBox="0 0 40 12"><path d="M1 6C11 1 30 1 39 6C29 11 10 11 1 6Z" /></svg>
      <svg className="lp-why__leaf lp-why__leaf--3" data-parallax="0.1" viewBox="0 0 40 12"><path d="M1 6C11 1 30 1 39 6C29 11 10 11 1 6Z" /></svg>
    </div>

    <div className="lp-why__inner">
      <div className="text-center max-w-2xl mx-auto reveal">
        <span className="lp-eyebrow lp-eyebrow--on-dark mb-5"><span className="lp-eyebrow__dot" /> Why the name</span>
        <h2 className="lp-why__title">
          Why{' '}
          <span className="lp-why__word">
            <span>Kaway</span><span className="lp-why__word-accent">an</span>
            <i className="lp-why__underline" />
          </span>{' '}
          AI?
        </h2>
        <p className="lp-why__lede">
          <AnimatedText
            text="Two Filipino ideas shape everything we build — connection and growth."
            base={0.2}
            step={0.028}
            bold={[8, 10]}
          />
        </p>
      </div>

      <div className="lp-why__grid">
        <article className="lp-why-card reveal reveal-d1">
          <div className="lp-why-card__viz lp-why-card__viz--wave">
            <span className="lp-why-card__ring" />
            <span className="lp-ripple" />
            <span className="lp-ripple" />
            <span className="lp-ripple" />
            <span className="lp-why-card__glyph"><WaveHandIcon className="lp-why-card__glyph-svg" /></span>
          </div>
          <h3 className="lp-why-card__title">
            <AnimatedText text="Kaway — a wave hello" step={0.05} bold={[0]} />
          </h3>
          <p className="lp-why-card__body">
            <AnimatedText
              base={0.3}
              step={0.014}
              bold={[0]}
              text="Kaway is the Filipino word for waving, for welcoming someone in. Marketing should do the same — greet people, start a conversation, and turn a scroll into a real connection. Kawayan AI helps your brand sound warm, human, and approachable."
            />
          </p>
        </article>

        <article className="lp-why-card reveal reveal-d2">
          <div className="lp-why-card__viz lp-why-card__viz--bamboo">
            <BambooGrowIcon />
          </div>
          <h3 className="lp-why-card__title">
            <AnimatedText text="Kawayan — bamboo strong" step={0.05} bold={[0]} />
          </h3>
          <p className="lp-why-card__body">
            <AnimatedText
              base={0.3}
              step={0.014}
              bold={[0]}
              text="Kawayan also means bamboo — fast to grow, quick to bend in a storm, and almost impossible to break. Your business can be the same: adaptable and resilient as platforms, trends, and algorithms keep shifting."
            />
          </p>
        </article>
      </div>

      <div className="lp-why__foot reveal reveal-d3">
        <p className="lp-why__foot-text">
          <AnimatedText
            base={0.1}
            step={0.02}
            text="Most of all, the name is about who we serve. Kawayan AI is built with Filipino businesses in mind — pairing AI with marketing that's culturally fluent and locally rooted."
          />
        </p>
        <div className="lp-why__tag">
          <Sprout className="w-4 h-4" />
          <span className="lp-why__tag-text">Grow local. Reach digital.</span>
          <Radio className="w-4 h-4" />
        </div>
      </div>
    </div>
  </section>
);

export default WhyKawayan;
