import React from 'react';
import { m } from 'motion/react';
import clsx from 'clsx';

interface Props<T extends string | null> {
  /** Unique per page, so each switch's highlight glides only within itself. */
  id: string;
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}

/** A small switch (calendar view, channel filter) whose highlight slides to the chosen option. */
function Segmented<T extends string | null>({ id, label, value, options, onChange }: Props<T>) {
  return (
    <div className="kw-seg" role="group" aria-label={label}>
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button key={text} type="button" aria-pressed={on} onClick={() => onChange(v)} className={clsx('relative', on && 'kw-seg__on')}>
            {on && (
              <m.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] bg-(--card) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                aria-hidden
              />
            )}
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
