import React from 'react';

interface Props {
  steps: string[];
  current: number; // zero-based
}

/** Named step + a segmented bar, so sign-up never reads as one long form. */
const StepProgress: React.FC<Props> = ({ steps, current }) => (
  <div className="ax-steps">
    <div className="ax-steps__top">
      <span className="ax-steps__label">{steps[current]}</span>
      <span className="ax-steps__count">Step {current + 1} of {steps.length}</span>
    </div>
    <div className="ax-steps__track">
      {steps.map((s, i) => (
        <span
          key={s}
          className={`ax-steps__seg${i < current ? ' is-done' : i === current ? ' is-current' : ''}`}
        >
          <i />
        </span>
      ))}
    </div>
  </div>
);

export default StepProgress;
