import React, { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, Clock, FileText } from 'lucide-react';
import { FacebookGlyph } from '../SocialAccounts';

// One curve for opening and closing, so the step closing and the step opening move together.
const EASE = [0.4, 0, 0.2, 1] as const;

/** One small piece of the real product per step, played when the step opens. */
const PermitPreview: React.FC = () => {
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setApproved(true), 1100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="ax-story__demo ax-story__permit">
      <FileText aria-hidden />
      <span className="ax-story__file">Mayors-Permit-2026.pdf</span>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={approved ? 'ok' : 'review'}
          className={`ax-story__pill ${approved ? 'is-ok' : 'is-wait'}`}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {approved ? <><Check aria-hidden /> Approved</> : <><Clock aria-hidden /> In review</>}
        </m.span>
      </AnimatePresence>
    </div>
  );
};

const PLAN = [
  { day: 'Mon 3', img: '/hero/ai/panaderia-1.jpg', title: 'Pandesal alert' },
  { day: 'Wed 5', img: '/hero/ai/panaderia-2.jpg', title: 'Ube ensaymada' },
  { day: 'Fri 7', img: '/hero/ai/panaderia-3.jpg', title: 'Behind the oven' },
];

const PlanPreview: React.FC = () => (
  <div className="ax-story__demo ax-story__plan">
    {PLAN.map((p, i) => (
      <m.div
        key={p.day}
        className="ax-story__post"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.18 + i * 0.07 }}
      >
        <img decoding="async" loading="lazy" src={p.img} alt="" />
        <span className="ax-story__day">{p.day}</span>
        <b>{p.title}</b>
      </m.div>
    ))}
  </div>
);

const PublishPreview: React.FC = () => {
  const [posted, setPosted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPosted(true), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="ax-story__demo ax-story__publish">
      <img decoding="async" loading="lazy" src="/hero/ai/panaderia-1.jpg" alt="" />
      <div className="ax-story__publish-text">
        <b>Pandesal alert</b>
        <span><FacebookGlyph className="h-3.5 w-3.5" /> Aling Nena’s Bakery</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={posted ? 'posted' : 'scheduled'}
          className={`ax-story__pill ${posted ? 'is-ok' : 'is-wait'}`}
          initial={{ opacity: 0, rotateX: -90 }}
          animate={{ opacity: 1, rotateX: 0 }}
          exit={{ opacity: 0, rotateX: 90 }}
          transition={{ duration: 0.25 }}
        >
          {posted ? <><Check aria-hidden /> Posted</> : <><Clock aria-hidden /> 9:00 AM</>}
        </m.span>
      </AnimatePresence>
    </div>
  );
};

const STEPS = [
  {
    title: 'We check your business permit',
    text: 'A person on our team reviews your Mayor’s Permit, DTI or SEC document, then opens up the full app.',
    Preview: PermitPreview,
  },
  {
    title: 'Kawayan plans your month',
    text: 'Tell it about your shop once. It suggests a month of post ideas and writes up to 8 posts with Taglish captions and images.',
    Preview: PlanPreview,
  },
  {
    title: 'You approve, it posts',
    text: 'Edit anything you like, then schedule to your Facebook Page and Instagram. Kawayan publishes at the time you pick.',
    Preview: PublishPreview,
  },
];

const AUTO_MS = 5200;

/**
 * Sign-up's side panel: what happens after you join, one step open at a time.
 * Steps advance on their own until the person clicks one.
 */
const SignupStory: React.FC = () => {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), AUTO_MS);
    return () => clearTimeout(t);
  }, [active, auto]);

  return (
    <m.aside
      className="ax__aside"
      aria-label="What happens after you sign up"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      <h2 className="ax__aside-title">What happens after you sign up</h2>
      <ol className="ax-story">
        {STEPS.map(({ title, text, Preview }, i) => {
          const open = i === active;
          return (
            <li key={title} className={open ? 'is-open' : ''}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => { setActive(i); setAuto(false); }}
                className="ax-story__head"
              >
                <span className="ax-story__num">{i + 1}</span>
                {title}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <m.div
                    key="body"
                    className="ax-story__body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.34, ease: EASE }, opacity: { duration: 0.24, delay: 0.1 } } }}
                    exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.34, ease: EASE }, opacity: { duration: 0.14 } } }}
                  >
                    <p>{text}</p>
                    <Preview />
                  </m.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </m.aside>
  );
};

export default SignupStory;
