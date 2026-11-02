import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Image as ImageIcon, Loader2, Sparkles, Trash2, Type, Video } from 'lucide-react';
import type { ContentIdea, GeneratedPost } from '../../types';
import { phDatesInMonth } from '../../utils/phCalendar';
import { normalizeFormat } from '../../services/validationService';
import KwSelect from '../ui/kw-select';

type Extras = { formats?: string[]; dates?: { day: number; name: string }[]; notes?: string };

interface Props {
  month: Date;
  /** Months the owner can plan: this one and the next two. */
  monthOptions: Date[];
  onMonthChange: (month: Date) => void;
  planLabel: string;
  batchPostCount: number;
  monthlyPostCount: number;
  /** Most ideas that fit: posts left in the plan and open days left. */
  maxPlanCount: number;
  scheduleRange: { minDay: number; maxDay: number };
  focus: string;
  onFocusChange: (v: string) => void;
  busy: boolean;
  progress: { current: number; total: number } | null;
  runPosts: GeneratedPost[];
  ideas: ContentIdea[];
  /** Ideas that would get a post now. */
  createCount: number;
  postStatusByDay: Record<number, GeneratedPost['status']>;
  onGenerate: (count: number, extras: Extras) => void;
  onCancel: () => void;
  onAddToCalendar: () => void;
  onWriteIdeas: () => void;
  onUpdateIdea: (index: number, field: keyof ContentIdea, value: string | number) => void;
  onDeleteIdea: (index: number) => void;
  onOpenDay: (day: number) => void;
  onOpenPost: (post: GeneratedPost) => void;
  onOpenBilling: () => void;
}

const COUNTS: { n: number; hint: string }[] = [
  { n: 8, hint: 'Twice a week' },
  { n: 12, hint: '3 a week' },
  { n: 16, hint: '4 a week' },
];
const FORMATS = [
  { key: 'Image', label: 'Single photo', Icon: ImageIcon },
  { key: 'Text', label: 'Text post', Icon: Type },
  { key: 'Video', label: 'Video', Icon: Video },
];
const FOCUS_PRESETS = ['Seasonal & local specials', 'New product launch', 'Promo / limited-time sale', 'Behind the scenes week', 'Customer spotlights', 'Educational tips & how-tos'];

const dayLabel = (month: Date, day: number) =>
  new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' });

/**
 * The Month planner page (mockup APP.planner). Left: the month, how many posts, formats, the dates
 * Kawayan found, notes and Generate. Right: the posts as they're written. All work runs through
 * ContentCalendar's planning handlers (the same AI calls as the planner dialog).
 */
const PlannerPage: React.FC<Props> = ({
  month, monthOptions, onMonthChange, planLabel, batchPostCount, monthlyPostCount, maxPlanCount, scheduleRange, focus, onFocusChange,
  busy, progress, runPosts, ideas, createCount, postStatusByDay, onGenerate, onCancel, onAddToCalendar, onWriteIdeas, onUpdateIdea,
  onDeleteIdea, onOpenDay, onOpenPost, onOpenBilling,
}) => {
  const monthName = month.toLocaleDateString('en-PH', { month: 'long' });
  const left = Math.max(0, batchPostCount - monthlyPostCount);
  const options = useMemo(() => {
    const list = COUNTS.filter((c) => c.n <= batchPostCount);
    if (maxPlanCount > 0 && !list.some((c) => c.n === maxPlanCount) && maxPlanCount < (list[list.length - 1]?.n ?? Infinity)) {
      list.push({ n: maxPlanCount, hint: 'All that’s left' });
    }
    return list.sort((a, b) => a.n - b.n);
  }, [batchPostCount, maxPlanCount]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const fit = options.filter((o) => o.n <= maxPlanCount);
    setCount(fit.length ? fit[fit.length - 1].n : 0);
  }, [options, maxPlanCount]);

  const [formats, setFormats] = useState<string[]>(['Image']);
  const found = useMemo(
    () => phDatesInMonth(month.getFullYear(), month.getMonth()).filter((d) => d.day >= scheduleRange.minDay && d.day <= scheduleRange.maxDay),
    [month, scheduleRange.minDay, scheduleRange.maxDay],
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => setPicked(new Set(found.map((d) => `${d.day}-${d.name}`))), [found]);
  const [notes, setNotes] = useState('');

  const total = progress?.total ?? 0;
  const ready = runPosts.length;
  const skeletons = busy ? Math.max(0, total - ready) : 0;
  const run = () =>
    onGenerate(count, {
      formats,
      dates: found.filter((d) => picked.has(`${d.day}-${d.name}`)).map((d) => ({ day: d.day, name: d.name })),
      notes,
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="kw-page-h">
        <div>
          <h1>Plan {monthName}</h1>
          <p>Kawayan writes your month. You review everything before it posts.</p>
        </div>
        <span className="badge badge-sage mono">{left} post{left === 1 ? '' : 's'} left in {monthName} on {planLabel}</span>
      </div>

      <div className="kw-planner">
        {/* ── Your month ── */}
        <section className="card" aria-labelledby="pl-title">
          <div className="kw-card-h"><h3 id="pl-title">Your month</h3></div>
          <div className="flex flex-col gap-[18px] p-4">
            <div className="kw-field">
              <label className="kw-label" htmlFor="pl-month">Month</label>
              <KwSelect
                id="pl-month"
                value={`${month.getFullYear()}-${month.getMonth()}`}
                disabled={busy}
                onValueChange={(v) => {
                  const [y, m] = v.split('-').map(Number);
                  onMonthChange(new Date(y, m, 1));
                }}
                options={monthOptions.map((d) => ({ value: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) }))}
              />
            </div>

            <div className="kw-field">
              <span className="kw-label" id="pl-count">How many posts?</span>
              <div className="kw-segpick" role="radiogroup" aria-labelledby="pl-count">
                {options.map((o) => (
                  <button
                    key={o.n}
                    type="button"
                    role="radio"
                    aria-checked={count === o.n}
                    aria-pressed={count === o.n}
                    disabled={busy || o.n > maxPlanCount}
                    onClick={() => setCount(o.n)}
                    title={o.n > maxPlanCount ? `Only ${maxPlanCount} fit: posts left in your plan and open days this month.` : undefined}
                  >
                    <b className="mono">{o.n}</b>
                    {o.hint}
                  </button>
                ))}
              </div>
              {batchPostCount < 16 && (
                <p className="kw-hint">
                  {planLabel} plans get {batchPostCount} posts a month.{' '}
                  <button type="button" className="underline underline-offset-2" onClick={onOpenBilling}>Pro gives 16</button>
                </p>
              )}
              {maxPlanCount === 0 && <p className="kw-hint text-(--danger)">No posts left to plan in {monthName}. Pick another month.</p>}
            </div>

            <div className="kw-field">
              <span className="kw-label" id="pl-formats">Formats</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="pl-formats">
                {FORMATS.map(({ key, label, Icon }) => {
                  const on = formats.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="kw-chip"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => setFormats((f) => (on ? (f.length > 1 ? f.filter((x) => x !== key) : f) : [...f, key]))}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <fieldset className="kw-field">
              <legend className="kw-label mb-1.5">Dates Kawayan found</legend>
              {found.length ? (
                <div className="flex flex-col gap-1.5 text-ui">
                  {found.map((d) => {
                    const id = `${d.day}-${d.name}`;
                    return (
                      <label key={id} className="kw-check">
                        <input
                          type="checkbox"
                          checked={picked.has(id)}
                          disabled={busy}
                          onChange={() => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                        />
                        <span><span className="mono">{month.toLocaleDateString('en-PH', { month: 'short' })} {d.day}</span> · {d.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="kw-hint">No holidays or paydays left in {monthName}.</p>
              )}
            </fieldset>

            <div className="kw-field">
              <label className="kw-label" htmlFor="pl-notes">Anything special this month?</label>
              <textarea
                id="pl-notes"
                className="input min-h-[72px] resize-y py-2.5"
                value={notes}
                maxLength={600}
                disabled={busy}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Noche Buena trays, ensaymada gift boxes. Closed Dec 25."
              />
            </div>

            <div className="kw-field">
              <span className="kw-label" id="pl-focus">Focus <span className="font-normal text-(--fg-muted)">(optional)</span></span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="pl-focus">
                {FOCUS_PRESETS.map((f) => (
                  <button key={f} type="button" className="kw-chip" aria-pressed={focus === f} disabled={busy} onClick={() => onFocusChange(focus === f ? '' : f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="btn btn-primary" onClick={run} disabled={busy || count === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {busy ? 'Writing your month…' : `Generate ${count} post${count === 1 ? '' : 's'}`}
            </button>
            <p className="kw-hint -mt-2">Failed AI calls never use up your posts or regenerations.</p>
          </div>
        </section>

        {/* ── Generating ── */}
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card" aria-labelledby="pl-gen-title" aria-busy={busy}>
            <div className="kw-card-h">
              <h3 id="pl-gen-title">{busy ? 'Generating' : ready ? 'Your new drafts' : 'Generating'}</h3>
              {(busy || ready > 0) && (
                <span className="flex items-center gap-2 text-xs text-(--fg-muted)">
                  <span className="mono" aria-live="polite">{ready} of {Math.max(total, ready)} ready</span>
                  <span className="h-1.5 w-[120px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" aria-hidden>
                    <i className="block h-full rounded-full bg-(--green)" style={{ width: `${total ? Math.min(100, (ready / total) * 100) : 100}%` }} />
                  </span>
                </span>
              )}
            </div>
            <div className="p-4">
              {!busy && ready === 0 ? (
                <div className="grid justify-items-center gap-2 px-4 py-10 text-center">
                  <CalendarDays className="h-6 w-6 text-(--fg-muted)" aria-hidden />
                  <p className="font-semibold">Your posts appear here as Kawayan writes them</p>
                  <p className="max-w-sm text-xs text-(--fg-muted)">Each one is saved as a draft with a caption, an image and a reach score. Nothing posts until you approve it.</p>
                </div>
              ) : (
                <div className="kw-gen-grid">
                  {runPosts.map((p, i) => (
                    <button key={p.id} type="button" className="kw-gen" style={{ animationDelay: `${Math.min(i, 6) * 80}ms` }} onClick={() => onOpenPost(p)}>
                      {p.imageUrl ? <img decoding="async" loading="lazy" src={p.imageUrl} alt="" /> : <span className="kw-gen__noimg"><ImageIcon className="h-5 w-5" aria-hidden /></span>}
                      <span className="flex flex-col gap-1.5 p-3 text-left text-xs">
                        <span className="flex items-center justify-between gap-2">
                          <span className="mono text-(--fg-muted)">{dayLabel(month, Number(p.date.slice(8, 10)))}</span>
                          <span className="badge badge-dashed">Draft</span>
                        </span>
                        <b className="text-ui font-medium text-(--fg)">{p.topic}</b>
                        <span className="text-(--fg-muted)">Reach {p.viralityScore ?? '—'}</span>
                      </span>
                    </button>
                  ))}
                  {Array.from({ length: skeletons }, (_, i) => <div key={`sk-${i}`} className="kw-gen kw-gen--sk" aria-hidden />)}
                </div>
              )}
              {(busy || ready > 0) && (
                <div className="mt-4 flex justify-end gap-2">
                  {busy && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
                  {!busy && ready > 0 && <button type="button" className="btn btn-primary" onClick={onAddToCalendar}>Add to calendar</button>}
                </div>
              )}
              {busy && <p className="kw-hint mt-2 text-right">Cancel stops after the post being written. Posts already written stay as drafts.</p>}
            </div>
          </section>

          {/* Existing plan ideas: edit, remove, or write posts for them (same as the planner dialog) */}
          {ideas.length > 0 && !busy && (
            <section className="card" aria-labelledby="pl-ideas-title">
              <div className="kw-card-h">
                <h3 id="pl-ideas-title">Ideas for {monthName}</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={onWriteIdeas} disabled={createCount === 0}>
                  <Sparkles className="h-4 w-4" aria-hidden /> Write {createCount} post{createCount === 1 ? '' : 's'}
                </button>
              </div>
              <ul className="divide-y divide-(--border)">
                {ideas.map((idea, i) => {
                  const status = postStatusByDay[idea.day];
                  return (
                    <li key={`${idea.day}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <button type="button" className="mono w-16 shrink-0 text-left text-xs text-(--fg-muted) hover:text-(--fg)" onClick={() => onOpenDay(idea.day)}>
                        {dayLabel(month, idea.day)}
                      </button>
                      <input
                        className="min-w-0 flex-1 bg-transparent text-ui font-medium outline-hidden"
                        value={idea.title}
                        aria-label={`Idea for ${dayLabel(month, idea.day)}`}
                        onChange={(e) => onUpdateIdea(i, 'title', e.target.value)}
                      />
                      <span className="badge">{normalizeFormat(idea.format)}</span>
                      {status ? <span className="badge badge-green">Has a post</span> : <span className="badge badge-dashed">Idea</span>}
                      <button type="button" className="kw-icon-btn h-8! w-8!" aria-label={`Remove idea “${idea.title}”`} onClick={() => onDeleteIdea(i)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerPage;
