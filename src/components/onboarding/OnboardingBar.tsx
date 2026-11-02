import React, { Suspense, lazy, useState } from 'react';
import { Check, LifeBuoy } from 'lucide-react';
import '../onboarding.css';

const HelpPanel = lazy(() => import('../HelpPanel'));

/** The app's real onboarding order: sign up, get the permit approved, then Brand DNA. */
const STEPS = ['Account', 'Verification', 'Brand DNA'];

/**
 * The onboarding part of the top bar (mockup .ob-top): "1 · Account / 2 · Verification /
 * 3 · Brand DNA" and Help desk (the same help panel as inside the app). Sits between the logo and
 * the account menu of the app's own top bar.
 */
const OnboardingBar: React.FC<{ current: number; done?: boolean; help?: boolean }> = ({ current, done, help = true }) => {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <div className="ob-top">
          <ol className="ob-steps" aria-label="Getting started">
            {STEPS.map((s, i) => {
              const state = i < current || (done && i === current) ? 'done' : i === current ? 'now' : 'next';
              return (
                <li key={s} className={`ob-steps__s is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                  <span className="ob-steps__n">{state === 'done' ? <Check aria-hidden /> : i + 1}</span>
                  <span className="ob-steps__l">{s}</span>
                </li>
              );
            })}
          </ol>
          {help && <div className="ob-top__tools">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setHelpOpen(true)} aria-label="Help desk">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> <span>Help desk</span>
            </button>
          </div>}
      </div>
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default OnboardingBar;
