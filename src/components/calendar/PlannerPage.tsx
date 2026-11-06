import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { KawayanMark } from '../KawayanLogo';
import type { ContentIdea, GeneratedPost } from '../../types';
import { phDatesInMonth } from '../../utils/phCalendar';
import { normalizeFormat } from '../../services/validationService';
import KwSelect from '../ui/kw-select';
import { ProgressBar } from '../ui/progress-bar';

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

const FOCUS_PRESETS = ['Seasonal & local specials', 'New product launch', 'Promo / limited-time sale', 'Behind the scenes week', 'Customer spotlights', 'Educational tips & how-tos'];

const dayLabel = (month: Date, day: number) =>
  new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' });

/**
 * The Month planner page. Before generating: one wide card (month, count and dates on the left; notes
 * and focus on the right) with Generate pinned to its bottom. Once Generate is clicked, the setup becomes
 * a sidebar and the posts appear beside it as they're written. All work runs through ContentCalendar's
 * planning handlers (the same AI calls as the planner dialog).
 */
const PlannerPage: React.FC<Props> = ({
  month, monthOptions, onMonthChange, planLabel, batchPostCount, monthlyPostCount, maxPlanCount, scheduleRange, focus, onFocusChange,
  busy, progress, runPosts, ideas, createCount, postStatusByDay, onGenerate, onCancel, onAddToCalendar, onWriteIdeas, onUpdateIdea,
  onDeleteIdea, onOpenDay, onOpenPost, onOpenBilling,
}) => {
  const monthName = month.toLocaleDateString('en-PH', { month: 'long' });
  const left = Math.max(0, batchPostCount - monthlyPostCount);
  // Any amount from 1 to what fits (posts left in the plan and open days); starts at everything that fits.
  const [count, setCount] = useState(0);
  useEffect(() => setCount(maxPlanCount), [maxPlanCount]);
  const setClamped = (n: number) => setCount(Math.max(maxPlanCount ? 1 : 0, Math.min(maxPlanCount, Math.round(n) || 0)));
  const weeks = Math.max(1, (scheduleRange.maxDay - scheduleRange.minDay + 1) / 7);
  const perWeek = Math.max(1, Math.round(count / weeks));

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
      dates: found.filter((d) => picked.has(`${d.day}-${d.name}`)).map((d) => ({ day: d.day, name: d.name })),
      notes,
    });

  // Before the first Generate: one wide setup card. Once posts are being written (or are ready), the setup
  // shrinks to a sidebar and the posts take the rest of the page.
  const started = busy || ready > 0;

  const monthField = (
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
  );

  const countField = (
    <div className="kw-field">
      <span className="kw-label" id="pl-count">How many posts?</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="kw-numstep" role="group" aria-labelledby="pl-count">
          <button type="button" aria-label="One fewer post" disabled={busy || count <= 1} onClick={() => setClamped(count - 1)}>
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-labelledby="pl-count"
            min={maxPlanCount ? 1 : 0}
            max={maxPlanCount}
            value={count}
            disabled={busy || maxPlanCount === 0}
            onChange={(e) => setClamped(Number(e.target.value))}
          />
          <button type="button" aria-label="One more post" disabled={busy || count >= maxPlanCount} onClick={() => setClamped(count + 1)}>
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {maxPlanCount > 0 && <span className="kw-hint">{maxPlanCount} left in {monthName} · about {perWeek} a week</span>}
      </div>
      {batchPostCount < 16 && (
        <p className="kw-hint">
          {planLabel} plans get {batchPostCount} posts a month.{' '}
          <button type="button" className="inline-flex min-h-6 items-center underline underline-offset-2" onClick={onOpenBilling}>Pro gives 16</button>
        </p>
      )}
      {maxPlanCount === 0 && <p className="kw-hint text-(--danger)">No posts left to plan in {monthName}. Pick another month.</p>}
    </div>
  );

  const datesField = (
    <fieldset className="kw-field">
      <legend className="kw-label mb-1.5">Dates Kawayan found</legend>
      {found.length ? (
        <div className="flex flex-wrap gap-1.5">
          {found.map((d) => {
            const id = `${d.day}-${d.name}`;
            const on = picked.has(id);
            return (
              <button
                key={id}
                type="button"
                className="kw-chip"
                aria-pressed={on}
                disabled={busy}
                onClick={() => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                <span className="mono">{month.toLocaleDateString('en-PH', { month: 'short' })} {d.day}</span> · {d.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="kw-hint">No holidays or paydays left in {monthName}.</p>
      )}
    </fieldset>
  );

  const notesField = (
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
  );

  const focusField = (
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
  );

  // Pinned to the bottom of the window while the options scroll, so Generate is always in reach.
  const cta = (
    <div className="kw-plan-cta">
      <button type="button" className="btn btn-primary" onClick={run} disabled={busy || count === 0}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KawayanMark size={16} />}
        {busy ? 'Writing your month…' : `Generate ${count} post${count === 1 ? '' : 's'}`}
      </button>
      <p className="kw-hint">Failed AI calls never use up your posts or regenerations.</p>
    </div>
  );

  const ideasSection = ideas.length > 0 && !busy && (
    <section className="card" aria-labelledby="pl-ideas-title">
      <div className="kw-card-h">
        <h3 id="pl-ideas-title">Ideas for {monthName}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onWriteIdeas} disabled={createCount === 0}>
          <KawayanMark size={16} /> Write {createCount} post{createCount === 1 ? '' : 's'}
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
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="kw-page-h">
        <div>
          <h1>Plan {monthName}</h1>
          <p>Kawayan writes your month. You review everything before it posts.</p>
        </div>
        <span className="badge badge-sage mono">{left} post{left === 1 ? '' : 's'} left in {monthName} on {planLabel}</span>
      </div>

      {!started ? (
        /* ── Before generating: one wide card. Numbers and dates on the left, what to write about on the right. ── */
        <div className="kw-plan-setup">
          <section className="card" aria-labelledby="pl-title">
            <div className="kw-card-h">
              <h3 id="pl-title">Your month</h3>
              <span className="hidden text-xs text-(--fg-muted) sm:inline">Each post is saved as a draft. Nothing posts until you approve it.</span>
            </div>
            <div className="kw-plan-setup__cols">
              <div className="flex flex-col gap-[18px]">{monthField}{countField}{datesField}</div>
              <div className="flex flex-col gap-[18px]">{notesField}{focusField}</div>
            </div>
            {cta}
          </section>
          {ideasSection}
        </div>
      ) : (
        /* ── Generating or done: the setup becomes a sidebar, the posts fill the rest ── */
        <div className="kw-planner kw-planner--run">
          <section className="card" aria-labelledby="pl-title">
            <div className="kw-card-h"><h3 id="pl-title">Your month</h3></div>
            <div className="flex flex-col gap-[18px] p-4">
              {monthField}{countField}{datesField}{notesField}{focusField}
            </div>
            {cta}
          </section>

          <div className="kw-plan-results flex min-w-0 flex-col gap-5">
            <section className="card" aria-labelledby="pl-gen-title" aria-busy={busy}>
              <div className="kw-card-h">
                <h3 id="pl-gen-title">{busy ? 'Writing your posts' : 'Your new drafts'}</h3>
                <span className="flex items-center gap-2 text-xs text-(--fg-muted)">
                  <span className="mono" aria-live="polite">{ready} of {Math.max(total, ready)} ready</span>
                  <ProgressBar done={ready} total={Math.max(total, ready, 1)} running={busy} label="Generating progress" className="w-[120px]" />
                </span>
              </div>
              <div className="p-4">
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
                <div className="mt-4 flex items-center justify-end gap-2">
                  {busy && <p className="kw-hint mr-auto">Cancel stops after the post being written. Posts already written stay as drafts.</p>}
                  {busy && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
                  {!busy && ready > 0 && <button type="button" className="btn btn-primary" onClick={onAddToCalendar}>Add to calendar</button>}
                </div>
              </div>
            </section>
            {ideasSection}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerPage;
