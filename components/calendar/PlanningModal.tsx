import React, { useEffect, useRef } from 'react';
import { ContentIdea, GeneratedPost } from '../../types';
import {
  X, RefreshCcw, Wand2, Loader2, ArrowUpRight, ArrowDown, Image as ImageIcon, Video, LayoutGrid, Type, Check,
  Sparkles, CalendarClock, CircleAlert,
} from 'lucide-react';
import './postComposer.css';
import './studio.css';
import './planningModal.css';

/**
 * PlanningModal: the month planner.
 *
 * Same shell as the post studio. Left: the month's focus and where you are in the flow
 * (focus, ideas, posts). Right: the ideas board, week by week, each idea editable and
 * showing whether its post exists yet. Bottom: one action bar (plan, re-plan, create).
 * Every action is a ContentCalendar handler.
 */
interface Props {
  open: boolean;
  /** The post studio is open on top of the planner; Escape belongs to it. */
  paused: boolean;
  onClose: () => void;
  monthLabel: string;
  planLabel: string;
  batchPostCount: number;
  monthlyPostCount: number;
  trialLimitReached: boolean;
  scheduleRange: { minDay: number; maxDay: number };
  batchStrategy: string;
  onStrategyChange: (v: string) => void;
  loadingPlan: boolean;
  batchProgress: { current: number; total: number } | null;
  creatingDay: number | null;
  ideas: ContentIdea[];
  postStatusByDay: Record<number, GeneratedPost['status']>;
  /** Ideas that would get a post if "Create" were pressed now (no post yet, within the plan's allowance). */
  createCount: number;
  onGeneratePlan: () => void;
  onBatchGenerate: () => void;
  onUpdateIdea: (index: number, field: keyof ContentIdea, value: string | number) => void;
  onOpenDay: (day: number) => void;
  onOpenBilling: () => void;
}

type FmtKey = ContentIdea['format'];
const FORMATS: { key: FmtKey; Icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: 'Image', Icon: ImageIcon, color: 'var(--primary)' },
  { key: 'Carousel', Icon: LayoutGrid, color: '#9CB080' },
  { key: 'Video', Icon: Video, color: '#D9791F' },
  { key: 'Text', Icon: Type, color: '#7C93B8' },
];

const STRATEGY_PRESETS = [
  'Seasonal & local specials',
  'New product launch',
  'Promo / limited-time sale',
  'Behind the scenes week',
  'Customer spotlights',
  'Educational tips & how-tos',
];

const STATUS: Record<string, { label: string; cls: string }> = {
  Draft: { label: 'Draft ready', cls: 'is-draft' },
  Scheduled: { label: 'Scheduled', cls: 'is-scheduled' },
  Published: { label: 'Published', cls: 'is-published' },
};

const FormatPicker: React.FC<{ value: FmtKey; disabled: boolean; onChange: (v: FmtKey) => void }> = ({ value, disabled, onChange }) => (
  <div className="pl-fmt" role="radiogroup" aria-label="Format">
    {FORMATS.map(({ key, Icon }) => (
      <button key={key} type="button" role="radio" aria-checked={value === key} title={key} disabled={disabled} onClick={() => onChange(key)}>
        <Icon />
        {value === key && <span>{key}</span>}
      </button>
    ))}
  </div>
);

const PlanningModal: React.FC<Props> = ({
  open,
  paused,
  onClose,
  monthLabel,
  planLabel,
  batchPostCount,
  monthlyPostCount,
  trialLimitReached,
  scheduleRange,
  batchStrategy,
  onStrategyChange,
  loadingPlan,
  batchProgress,
  creatingDay,
  ideas,
  postStatusByDay,
  createCount,
  onGeneratePlan,
  onBatchGenerate,
  onUpdateIdea,
  onOpenDay,
  onOpenBilling,
}) => {
  const latest = useRef({ paused, onClose });
  useEffect(() => {
    latest.current = { paused, onClose };
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !latest.current.paused) latest.current.onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // "October 2026" → real dates for weekdays, week groups and ranges.
  const parsed = new Date(`${monthLabel} 1`);
  const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
  const month = Number.isNaN(parsed.getTime()) ? new Date().getMonth() : parsed.getMonth();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'long' });
  const mon = new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'short' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekday = (day: number) => new Date(year, month, day).toLocaleDateString('en-PH', { weekday: 'short' });
  const rangeText = `${mon} ${scheduleRange.minDay} – ${mon} ${scheduleRange.maxDay}`;

  const planning = loadingPlan && !batchProgress;
  const creating = !!batchProgress;
  const busy = loadingPlan;
  const withPosts = ideas.filter((i) => postStatusByDay[i.day]).length;
  const remaining = Math.max(0, batchPostCount - monthlyPostCount);
  const usagePct = batchPostCount > 0 ? Math.min(100, (monthlyPostCount / batchPostCount) * 100) : 0;
  const focus = batchStrategy.trim();

  // Week groups (Sunday start), keeping each idea's index in the plan for edits.
  const weeks = new Map<number, { idea: ContentIdea; index: number }[]>();
  ideas
    .map((idea, index) => ({ idea, index }))
    .sort((a, b) => a.idea.day - b.idea.day)
    .forEach((row) => {
      const start = row.idea.day - new Date(year, month, row.idea.day).getDay();
      weeks.set(start, [...(weeks.get(start) || []), row]);
    });
  const weekLabel = (start: number) => `${mon} ${Math.max(1, start)} – ${Math.min(daysInMonth, start + 6)}`;

  const mix = FORMATS.map((f) => ({ ...f, n: ideas.filter((i) => (i.format || 'Image') === f.key).length }));

  const flow = [
    {
      title: 'Set a focus',
      sub: focus ? `“${focus.length > 42 ? `${focus.slice(0, 42)}…` : focus}”` : 'Optional, but it sharpens every idea',
      state: focus || ideas.length ? 'done' : 'active',
    },
    {
      title: `Plan ${batchPostCount} ideas`,
      sub: ideas.length ? `${ideas.length} ideas, ${rangeText}` : `Dated ${rangeText}`,
      state: planning ? 'busy' : ideas.length ? 'done' : focus ? 'active' : 'todo',
    },
    {
      title: 'Create the posts',
      sub: creating
        ? `${batchProgress!.current} of ${batchProgress!.total} done`
        : ideas.length
          ? `${withPosts} of ${ideas.length} ideas have a post`
          : 'Captions, scores and visuals for every idea',
      state: creating ? 'busy' : ideas.length && withPosts >= ideas.length ? 'done' : ideas.length ? 'active' : 'todo',
    },
  ];

  return (
    <div className="kw-composer-overlay" role="presentation">
      <div className="kw-composer-backdrop" onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-labelledby="planning-title" className="kw-composer ps pl">
        {/* ── Header ── */}
        <header className="ps-head">
          <span className="ps-head__date">{monthLabel}</span>
          <div className="ps-head__title">
            <h2 id="planning-title">Plan your month</h2>
            <div className="ps-head__meta">
              <span className="pl-plan">{planLabel} plan</span>
              <span className="pl-usage">
                <span className="pl-usage__bar" aria-hidden><b style={{ width: `${usagePct}%` }} /></span>
                {monthlyPostCount} of {batchPostCount} posts used
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close planner" className="kw-composer__close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="pl-body">
          {/* ── Brief ── */}
          <aside className="pl-brief">
            {trialLimitReached && (
              <div className="pl-limit" role="status">
                <span><CircleAlert /> You’ve used all {batchPostCount} posts for {monthName}.</span>
                {planLabel !== 'Pro' && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={onOpenBilling}>Upgrade to Pro</button>
                )}
              </div>
            )}

            <section className="pl-focus">
              <label className="pl-label" htmlFor="pl-focus">Focus for {monthName}</label>
              <textarea
                id="pl-focus"
                rows={3}
                value={batchStrategy}
                onChange={(e) => onStrategyChange(e.target.value)}
                disabled={busy}
                placeholder="e.g. “Undas promo for our ube pandesal” or “New branch in Cubao”"
              />
              <p className="pl-hint">Kawayan plans the month around this. Change it any time, then re-plan.</p>
              <div className="pl-presets" role="group" aria-label="Focus ideas">
                {STRATEGY_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={focus === s}
                    disabled={busy}
                    onClick={() => onStrategyChange(focus === s ? '' : s)}
                  >
                    <Sparkles /> {s}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <span className="pl-label">Your progress</span>
              <ol className="pl-flow">
                {flow.map((step, i) => (
                  <li key={step.title} className={`is-${step.state}`}>
                    <span className="pl-flow__dot">
                      {step.state === 'done' ? <Check /> : step.state === 'busy' ? <Loader2 className="animate-spin" /> : i + 1}
                    </span>
                    <span>
                      <b>{step.title}</b>
                      <small>{step.sub}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>

          {/* ── Ideas board ── */}
          <main className="pl-board" aria-live="polite">
            {planning && (
              <>
                <p className="pl-statusline">
                  <Loader2 className="animate-spin" />
                  Planning {batchPostCount} ideas{focus ? ` around “${focus}”` : ''}…
                </p>
                <div className="pl-ideas">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="pl-skel" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                      <i className="pl-shimmer" />
                      <span>
                        <i className="pl-shimmer" style={{ width: '55%' }} />
                        <i className="pl-shimmer" style={{ width: '85%' }} />
                        <i className="pl-shimmer" style={{ width: '35%', height: 18 }} />
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!planning && ideas.length === 0 && (
              <div className="pl-empty">
                <div className="pl-ghosts" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="pl-ghost">
                      <i />
                      <span><i /><i /></span>
                    </div>
                  ))}
                </div>
                <h3>Your month, planned in seconds</h3>
                <p>
                  Kawayan drafts {batchPostCount} dated ideas from {rangeText}, in your brand voice{focus ? ', around your focus' : ''}.
                  You can edit every one before any post is made.
                </p>
                <span className="pl-empty__hint"><ArrowDown /> Press “Plan {batchPostCount} ideas” to start</span>
              </div>
            )}

            {!planning && ideas.length > 0 && (
              <>
                <div className="pl-toolbar">
                  <h3>
                    {ideas.length} ideas <span>· {rangeText}</span>
                  </h3>
                  <div className="pl-mix">
                    {mix.map((f) => (
                      <span key={f.key} className={f.n === 0 ? 'is-zero' : ''}>
                        <i style={{ background: f.color }} /> {f.key} {f.n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pl-mixbar" aria-hidden>
                  {mix.filter((f) => f.n > 0).map((f) => (
                    <b key={f.key} style={{ flexGrow: f.n, background: f.color }} />
                  ))}
                </div>

                {[...weeks.entries()].map(([start, rows]) => (
                  <section key={start} className="pl-week">
                    <h4 className="pl-week__head">Week of {weekLabel(start)}</h4>
                    <div className="pl-ideas">
                      {rows.map(({ idea, index }) => {
                        const status = postStatusByDay[idea.day];
                        const isCreating = creatingDay === idea.day;
                        const passed = !status && idea.day < scheduleRange.minDay; // batch create skips these
                        const queued = creating && !status && !isCreating && !passed;
                        const chip = isCreating
                          ? { label: 'Creating…', cls: 'is-creating' }
                          : status
                            ? STATUS[status]
                            : passed
                              ? { label: 'Day passed', cls: 'is-queued' }
                              : queued
                                ? { label: 'Queued', cls: 'is-queued' }
                                : null;
                        return (
                          <article key={`${idea.day}-${index}`} className={`pl-idea${isCreating ? ' is-creating' : ''}${status ? ' has-post' : ''}`}>
                            <div className="pl-idea__date">
                              <span>{weekday(idea.day)}</span>
                              <b>{idea.day}</b>
                            </div>
                            <div className="pl-idea__body">
                              <input
                                className="pl-idea__title"
                                value={idea.title}
                                onChange={(e) => onUpdateIdea(index, 'title', e.target.value)}
                                readOnly={creating}
                                placeholder="Idea heading"
                                aria-label={`Heading for ${mon} ${idea.day}`}
                              />
                              <textarea
                                className="pl-idea__topic"
                                value={idea.topic}
                                onChange={(e) => onUpdateIdea(index, 'topic', e.target.value)}
                                readOnly={creating}
                                rows={2}
                                placeholder="What the post is about"
                                aria-label={`Topic for ${mon} ${idea.day}`}
                              />
                              <div className="pl-idea__foot">
                                <FormatPicker value={idea.format} disabled={creating} onChange={(v) => onUpdateIdea(index, 'format', v)} />
                                {chip && (
                                  <span className={`pl-status ${chip.cls}`}>
                                    {isCreating ? <Loader2 className="animate-spin" /> : status === 'Scheduled' ? <CalendarClock /> : status ? <Check /> : null}
                                    {chip.label}
                                  </span>
                                )}
                                <button type="button" className="pl-open" onClick={() => onOpenDay(idea.day)} disabled={isCreating}>
                                  {status ? 'Open post' : 'Write now'} <ArrowUpRight />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}
          </main>
        </div>

        {/* ── Action bar ── */}
        <footer className="ps-foot pl-foot">
          <div className="pl-foot__info">
            {creating ? (
              <>
                <span>
                  <b>Writing post {Math.min(batchProgress!.current + 1, batchProgress!.total)} of {batchProgress!.total}</b> · captions and visuals
                </span>
                <span className="pl-progress" aria-hidden>
                  <b style={{ width: `${batchProgress!.total ? (batchProgress!.current / batchProgress!.total) * 100 : 0}%` }} />
                </span>
              </>
            ) : planning ? (
              <span>This takes about 15 seconds.</span>
            ) : ideas.length === 0 ? (
              <span>Ideas will be dated <b>{rangeText}</b>.</span>
            ) : createCount > 0 ? (
              <span>
                <b>{createCount} idea{createCount === 1 ? '' : 's'}</b> ready to become posts · {remaining} post{remaining === 1 ? '' : 's'} left this month
              </span>
            ) : withPosts >= ideas.length ? (
              <span>Every idea has a post. Open any of them to edit or schedule.</span>
            ) : (
              <span>No posts left in your plan this month.</span>
            )}
          </div>

          <div className="pl-foot__actions">
            {ideas.length === 0 ? (
              <button type="button" className="ps-cta" onClick={onGeneratePlan} disabled={busy}>
                {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {planning ? 'Planning…' : `Plan ${batchPostCount} ideas`}
              </button>
            ) : (
              <>
                <button type="button" className="pl-btn" onClick={onGeneratePlan} disabled={busy}>
                  {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Re-plan
                </button>
                <button type="button" className="ps-cta" onClick={onBatchGenerate} disabled={busy || createCount === 0 || trialLimitReached}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {creating
                    ? `Creating ${batchProgress!.current}/${batchProgress!.total}…`
                    : createCount === 0
                      ? 'Nothing new to create'
                      : `Create ${createCount} post${createCount === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlanningModal;
