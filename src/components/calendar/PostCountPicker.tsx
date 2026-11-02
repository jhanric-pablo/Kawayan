import React from 'react';
import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  /** Days from today on with no post yet, ascending. */
  openDays: number[];
  /** Days that already have a post. */
  takenDays: Set<number>;
  /** First day still ahead (1 for future months). */
  minDay: number;
  daysInMonth: number;
}

/** Spread `n` posts evenly over the open days, the same way the planner places ideas. */
const spread = (open: number[], n: number) =>
  new Set(n <= 0 ? [] : Array.from({ length: n }, (_, i) => open[n === 1 ? 0 : Math.round((i * (open.length - 1)) / (n - 1))]));

/**
 * How many posts to plan: a stepper and slider on one line, cadence presets an owner thinks in
 * ("2 a week"), and a month strip showing where the posts would land.
 */
const PostCountPicker: React.FC<Props> = ({ value, max, onChange, disabled, openDays, takenDays, minDay, daysInMonth }) => {
  const weeks = Math.max(1, openDays.length / 7);
  const presets: { label: string; n: number }[] = [];
  [
    { label: '1 a week', n: Math.round(weeks) },
    { label: '2 a week', n: Math.round(weeks * 2) },
    { label: '3 a week', n: Math.round(weeks * 3) },
    { label: 'Every other day', n: Math.ceil(openDays.length / 2) },
  ].forEach((p) => {
    const n = Math.min(max, Math.max(1, p.n));
    if (n < max && !presets.some((q) => q.n === n)) presets.push({ ...p, n });
  });
  presets.push({ label: 'Max', n: max });

  const picked = spread(openDays, value);
  const perWeek = Math.max(1, Math.round(value / weeks));
  const set = (n: number) => onChange(Math.min(max, Math.max(1, n)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-(--border) bg-(--card)">
          <button type="button" onClick={() => set(value - 1)} disabled={disabled || value <= 1} aria-label="One fewer post" className="grid h-9 w-9 place-items-center text-(--fg-muted) hover:text-(--fg) disabled:opacity-40">
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <output className="min-w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">{value}</output>
          <button type="button" onClick={() => set(value + 1)} disabled={disabled || value >= max} aria-label="One more post" className="grid h-9 w-9 place-items-center text-(--fg-muted) hover:text-(--fg) disabled:opacity-40">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <input
          type="range"
          min={1}
          max={max}
          value={value}
          disabled={disabled || max <= 1}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="How many posts"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-(--primary) disabled:cursor-default"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick picks">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={value === p.n}
            disabled={disabled}
            onClick={() => set(p.n)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
              value === p.n ? 'border-(--primary) bg-(--green-soft) text-(--primary)' : 'border-(--border) bg-(--card) text-(--fg-muted) hover:text-(--fg)',
            )}
          >
            {p.label} <span className="tabular-nums opacity-70">{p.n}</span>
          </button>
        ))}
      </div>

      {/* Where they'd land: one square per day. */}
      <div>
        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <span
              key={d}
              title={`Day ${d}`}
              className={clsx(
                'h-3 min-w-0 flex-1 rounded-[3px] transition-colors duration-200',
                d < minDay ? 'bg-(--border) opacity-40' : takenDays.has(d) ? 'bg-(--fg-subtle)' : picked.has(d) ? 'bg-(--green)' : 'bg-(--border)',
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-(--fg-muted)">
          <b className="font-semibold text-(--fg)">{value} post{value === 1 ? '' : 's'}</b>, about {perWeek} a week, one per day.
          <span className="text-(--fg-subtle)"> Most you can plan: {max}.</span>
        </p>
      </div>
    </div>
  );
};

export default PostCountPicker;
