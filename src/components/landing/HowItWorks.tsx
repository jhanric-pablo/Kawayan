import React, { useRef } from 'react';
import { prefersReducedMotion, useCycle, useInView } from './useLandingMotion';

const STEP_MS = 5200;

const STEPS = [
  { title: 'Tell us your brand', desc: 'Four quick questions: your industry, audience, voice and the topics you post about.' },
  { title: 'Kawayan plans your month', desc: 'One click drafts a month of Taglish captions with matching images, laid out on your calendar.' },
  { title: 'Preview, schedule, post', desc: 'See how each post looks on Facebook and Instagram, pick a time, and it goes out on its own.' },
];

/* ── Scene 1: the brand survey fills itself in ── */
const SURVEY = [
  ['Industry', 'Panaderia'],
  ['Audience', 'Students and titas nearby'],
  ['Voice', 'Masaya, kwela'],
  ['Themes', 'Pandesal, promos, behind the scenes'],
];
const SurveyScene = () => (
  <div className="lp-how-card">
    <p className="lp-how-card__label">Brand survey</p>
    <ul className="lp-survey">
      {SURVEY.map(([q, a], i) => (
        <li key={q} className="lp-survey__row" style={{ '--n': i } as React.CSSProperties}>
          <span className="lp-survey__q">{q}</span>
          <span className="lp-survey__a">{a}</span>
        </li>
      ))}
    </ul>
  </div>
);

/* ── Scene 2: the month fills with posts ── */
const POST_DAYS = [3, 6, 10, 13, 17, 20, 24, 27];
const PlanScene = () => (
  <div className="lp-how-card">
    <div className="lp-plan__head">
      <p className="lp-how-card__label">November</p>
      <p className="lp-plan__count"><b>8</b> posts planned</p>
    </div>
    <div className="lp-plan__grid">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="lp-plan__dow">{d}</span>)}
      {Array.from({ length: 30 }, (_, i) => {
        const day = i + 1;
        const slot = POST_DAYS.indexOf(day);
        return (
          <span key={day} className={`lp-plan__day${slot >= 0 ? ' has-post' : ''}`} style={{ '--n': slot } as React.CSSProperties}>
            {day}
            {slot >= 0 && <i className="lp-plan__chip" />}
          </span>
        );
      })}
    </div>
  </div>
);

/* ── Scene 3: the post is scheduled, then goes out ── */
const PostScene = () => (
  <div className="lp-how-card lp-how-card--post">
    <div className="lp-fpost">
      <div className="lp-fpost__head">
        <span className="lp-fpost__avatar">A</span>
        <span>
          <b>Aling Nena&rsquo;s Bakery</b>
          <small>Facebook · Instagram</small>
        </span>
      </div>
      <p className="lp-fpost__text">Pandesal alert! Mainit pa at bagong luto, 6 AM pa lang. Kita-kits sa tindahan!</p>
      <div className="lp-fpost__img"><span>Pandesal · 6 AM</span></div>
    </div>
    <div className="lp-status">
      <span className="lp-status__a"><i className="lp-status__dot" /> Scheduled · Fri, 7:00 AM</span>
      <span className="lp-status__b"><i className="lp-status__dot" /> Published to Facebook and Instagram</span>
    </div>
  </div>
);

const SCENES = [SurveyScene, PlanScene, PostScene];

/** "How it works" as a short auto-playing walkthrough; each step can also be picked by hand. */
const HowItWorks: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [active, setActive] = useCycle(STEPS.length, STEP_MS, inView);
  const Scene = SCENES[active];
  const still = prefersReducedMotion();

  return (
    <div ref={ref} className="lp-how reveal">
      <div className="lp-how__steps" role="tablist" aria-label="How it works">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            id={`how-tab-${i}`}
            aria-selected={i === active}
            aria-controls="how-stage"
            onClick={() => setActive(i)}
            className={`lp-how__step${i === active ? ' is-active' : ''}`}
          >
            <span className="lp-how__num">{i + 1}</span>
            <span className="lp-how__text">
              <span className="lp-how__title">{s.title}</span>
              <span className="lp-how__desc">{s.desc}</span>
            </span>
            {/* Story-style timer; restarts whenever the step changes */}
            {i === active && inView && !still && <i key={`bar-${active}`} className="lp-how__bar" style={{ animationDuration: `${STEP_MS}ms` }} />}
          </button>
        ))}
      </div>

      <div id="how-stage" role="tabpanel" aria-labelledby={`how-tab-${active}`} className="lp-how__stage">
        {/* key restarts the scene's entrance animations each time it comes back */}
        <div key={active} className="lp-how__scene"><Scene /></div>
      </div>
    </div>
  );
};

export default HowItWorks;
