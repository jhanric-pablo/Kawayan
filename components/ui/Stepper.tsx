import React, { Children, isValidElement, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import './stepper.css';

export interface StepProps {
  /** Shown under this step's number in the progress track. */
  label: string;
  children: React.ReactNode;
}

/** One step of a <Stepper>; renders its children as the step's content. */
export const Step: React.FC<StepProps> = ({ children }) => <>{children}</>;

interface StepperProps {
  children: React.ReactNode;
  /** Controlled mode: the parent owns the current step (pair with onStepChange). */
  index?: number;
  onStepChange?: (index: number) => void;
  /** Set false when the parent renders its own Back/Next (e.g. a form with submit-to-advance). */
  showNav?: boolean;
  onComplete?: () => void;
  /** Return false to disable Next on a step, e.g. while a required field is empty. */
  canAdvance?: (index: number) => boolean;
  nextLabel?: string;
  backLabel?: string;
  finishLabel?: string;
}

const Stepper: React.FC<StepperProps> = ({
  children,
  index: controlledIndex,
  onStepChange,
  showNav = true,
  onComplete,
  canAdvance = (_index: number) => true,
  nextLabel = 'Next',
  backLabel = 'Back',
  finishLabel = 'Finish',
}) => {
  const steps = Children.toArray(children).filter(isValidElement) as React.ReactElement<StepProps>[];
  const [ownIndex, setOwnIndex] = useState(0);
  const index = controlledIndex ?? ownIndex;
  const [height, setHeight] = useState<number>();
  const panelRef = useRef<HTMLDivElement>(null);
  const last = steps.length - 1;

  // Slide direction follows the last step change, however it happened (our buttons or the parent).
  const lastIndex = useRef(index);
  const direction = useRef<'forward' | 'back'>('forward');
  if (index !== lastIndex.current) {
    direction.current = index > lastIndex.current ? 'forward' : 'back';
    lastIndex.current = index;
  }

  // Ease the viewport between steps of different heights (and as content grows within a step).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => setHeight(panel.offsetHeight));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [index]);

  const goTo = (next: number) => {
    if (controlledIndex === undefined) setOwnIndex(next);
    onStepChange?.(next);
  };

  return (
    <div className="kw-stepper">
      <ol className="kw-stepper__track">
        {steps.map((step, i) => {
          const state = i < index ? 'done' : i === index ? 'current' : 'todo';
          return (
            <li key={i} className={`kw-stepper__item is-${state}`}>
              <button
                type="button"
                className="kw-stepper__dot"
                onClick={() => goTo(i)}
                disabled={i >= index}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step.props.label}${state === 'done' ? ', completed' : ''}`}
              >
                {state === 'done' ? <Check aria-hidden /> : i + 1}
              </button>
              <span className="kw-stepper__label">{step.props.label}</span>
              {i < last && (
                <span className="kw-stepper__line" aria-hidden>
                  <b />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="kw-stepper__viewport" style={{ height }}>
        <div
          ref={panelRef}
          key={index}
          className={`kw-stepper__panel is-${direction.current}`}
          role="group"
          aria-label={`Step ${index + 1} of ${steps.length}: ${steps[index]?.props.label}`}
        >
          {steps[index]}
        </div>
      </div>

      {showNav && (
        <div className="kw-stepper__nav">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="btn btn-ghost"
            style={index === 0 ? { visibility: 'hidden' } : undefined}
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </button>
          <button
            type="button"
            onClick={() => (index === last ? onComplete?.() : goTo(index + 1))}
            disabled={!canAdvance(index)}
            className="btn btn-primary"
          >
            {index === last ? finishLabel : nextLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Stepper;
