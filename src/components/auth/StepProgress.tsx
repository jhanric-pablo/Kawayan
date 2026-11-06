import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  steps: string[];
  current: number; // zero-based
}

/** Numbered stepper: circles joined by a line that fills in; done steps get a check, the current one a soft halo. */
const StepProgress: React.FC<Props> = ({ steps, current }) => (
  <ol className="ax-steps" aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
    {steps.map((s, i) => {
      const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
      return (
        <li key={s} className={`ax-steps__item ${state}`} aria-current={i === current ? 'step' : undefined}>
          <span className="ax-steps__dot">{i < current ? <Check aria-hidden /> : i + 1}</span>
          <span className="ax-steps__name">{s}</span>
        </li>
      );
    })}
  </ol>
);

export default StepProgress;
