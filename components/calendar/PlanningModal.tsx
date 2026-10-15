import React, { useEffect, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { ContentIdea, GeneratedPost } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import {
  X, RefreshCcw, Loader2, ArrowUpRight, Check, CircleAlert, Sparkles, Ellipsis, PencilLine, CalendarArrowUp, Trash2,
  Image as ImageIcon, Video, Type,
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import clsx from 'clsx';
import FormatPicker from './FormatPicker';
import ChannelTimelineTrack from './ChannelTimelineTrack';
import type { TimelineCardItem } from './mapCalendarEvents';
import type { PostChannels } from '../../utils/workspaceFeed';
import { PRIMARY_BTN } from './PostComposer';

/**
 * PlanningModal: the month planner.
 *
 * Left: the month's focus, starting points and where you are in the flow (focus, ideas, posts).
 * Right: the month on the channel timeline. The AI's ideas ride the top lane as dashed capsules
 * (edit, reschedule, delete); what's already scheduled or posted sits in each channel's lane.
 * Bottom: one action bar (plan, re-plan, create). Every action is a ContentCalendar handler.
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
  /** For the timeline's channel lanes. */
  posts: GeneratedPost[];
  accounts: SocialAccount[] | null;
  channels: PostChannels;
  failedIds: string[];
  onGeneratePlan: () => void;
  onBatchGenerate: () => void;
  onUpdateIdea: (index: number, field: keyof ContentIdea, value: string | number) => void;
  onDeleteIdea: (index: number) => void;
  onOpenDay: (day: number) => void;
  onOpenBilling: () => void;
}

const FORMATS: { key: ContentIdea['format']; color: string; Icon: React.ElementType }[] = [
  { key: 'Image', color: 'var(--primary)', Icon: ImageIcon },
  { key: 'Video', color: '#D9791F', Icon: Video },
  { key: 'Text', color: '#7C93B8', Icon: Type },
];

const STRATEGY_PRESETS = [
  'Seasonal & local specials',
  'New product launch',
  'Promo / limited-time sale',
  'Behind the scenes week',
  'Customer spotlights',
  'Educational tips & how-tos',
];

const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]';
const INPUT =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] px-3 py-2 text-[13px] text-[var(--fg)] outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-[var(--ring)] read-only:opacity-70';
const MENU_ITEM =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none data-[highlighted]:bg-[var(--bg-alt)]';

interface CapsuleProps {
  idea: ContentIdea;
  mon: string;
  chip: { label: string; busy?: boolean } | null;
  locked: boolean;
  dayOptions: { day: number; label: string }[];
  onUpdate: (field: keyof ContentIdea, value: string | number) => void;
  onDelete: () => void;
  onWrite: () => void;
}

/** One AI idea on the timeline: a dashed capsule with a hover menu and an editor popover. */
const IdeaCapsule: React.FC<CapsuleProps> = ({ idea, mon, chip, locked, dayOptions, onUpdate, onDelete, onWrite }) => {
  const [mode, setMode] = useState<'edit' | 'move' | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLSelectElement>(null);
  const FormatIcon = FORMATS.find((f) => f.key === idea.format)?.Icon ?? ImageIcon;
  // Opened from the menu: wait for the menu to hand focus back before the editor takes it.
  const openAs = (m: 'edit' | 'move') => requestAnimationFrame(() => setMode(m));

  return (
    <div className="group relative z-10">
      <Popover.Root open={!!mode} onOpenChange={(o) => setMode(o ? 'edit' : null)}>
        <Popover.Trigger
          disabled={locked}
          aria-label={`Idea for ${mon} ${idea.day}: ${idea.title || 'untitled'}. Edit`}
          className={clsx(
            'block w-full rounded-xl border border-dashed p-2 pr-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            chip?.busy
              ? 'border-brand bg-brand/15 ring-2 ring-brand/40'
              : 'border-brand/60 bg-brand/[0.07] hover:border-brand hover:bg-brand/[0.12] data-[popup-open]:border-brand data-[popup-open]:bg-brand/[0.12]',
            locked && !chip?.busy && 'opacity-70',
          )}
        >
          <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-[var(--fg)]">{idea.title || 'Untitled idea'}</span>
          <span className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-[var(--primary)]">
            {chip?.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FormatIcon className="h-3 w-3" aria-hidden />}
            {chip ? chip.label : 'Idea'}
          </span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[95]">
            <Popover.Popup
              initialFocus={mode === 'move' ? dayRef : titleRef}
              className="w-[min(92vw,320px)] space-y-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-4 text-[var(--fg)] shadow-xl outline-none transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            >
              <Popover.Title className="text-sm font-bold">{mode === 'move' ? 'Reschedule idea' : 'Edit idea'}</Popover.Title>
              {mode !== 'move' && (
                <>
                  <label className="block space-y-1">
                    <span className={LABEL}>Heading</span>
                    <input ref={titleRef} value={idea.title} onChange={(e) => onUpdate('title', e.target.value)} placeholder="Idea heading" className={INPUT} />
                  </label>
                  <label className="block space-y-1">
                    <span className={LABEL}>What it’s about</span>
                    <textarea value={idea.topic} rows={3} onChange={(e) => onUpdate('topic', e.target.value)} placeholder="What the post is about" className={clsx(INPUT, 'resize-y')} />
                  </label>
                  <div className="space-y-1">
                    <span className={LABEL}>Format</span>
                    <div><FormatPicker value={idea.format} onChange={(v) => onUpdate('format', v)} /></div>
                  </div>
                </>
              )}
              <label className="block space-y-1">
                <span className={LABEL}>Day</span>
                <select ref={dayRef} value={idea.day} onChange={(e) => onUpdate('day', Number(e.target.value))} className={INPUT}>
                  {dayOptions.map((o) => <option key={o.day} value={o.day}>{o.label}</option>)}
                </select>
              </label>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => { setMode(null); onWrite(); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)] hover:underline">
                  Write now <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <Popover.Close className={clsx(PRIMARY_BTN, 'px-4 py-1.5 text-[13px]')}>Done</Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {!locked && (
        <Menu.Root>
          <Menu.Trigger
            aria-label={`Actions for ${idea.title || 'idea'}`}
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded text-[var(--fg-muted)] opacity-0 transition-opacity hover:bg-[var(--bg-alt)] hover:text-[var(--fg)] focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
          >
            <Ellipsis className="h-3.5 w-3.5" strokeWidth={2} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[95]">
              <Menu.Popup className="min-w-[164px] origin-[var(--transform-origin)] rounded-lg border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-lg transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                <Menu.Item className={MENU_ITEM} onClick={() => openAs('edit')}>
                  <PencilLine className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Edit
                </Menu.Item>
                <Menu.Item className={MENU_ITEM} onClick={() => openAs('move')}>
                  <CalendarArrowUp className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Reschedule
                </Menu.Item>
                <Menu.Item className={MENU_ITEM} onClick={onWrite}>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Write now
                </Menu.Item>
                <Menu.Separator className="my-1 h-px bg-[var(--border)]" />
                <Menu.Item className={clsx(MENU_ITEM, 'text-red-600 dark:text-red-300')} onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  );
};

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
  posts,
  accounts,
  channels,
  failedIds,
  onGeneratePlan,
  onBatchGenerate,
  onUpdateIdea,
  onDeleteIdea,
  onOpenDay,
  onOpenBilling,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ paused, onClose });
  useEffect(() => {
    latest.current = { paused, onClose };
  });

  // Escape closes the planner, unless it's meant for something on top (the studio, a popover, a confirm).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Node;
      const forUs = target === document.body || !!dialogRef.current?.contains(target);
      if (e.key === 'Escape' && forUs && !latest.current.paused) latest.current.onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // "October 2026" → real dates for weekdays and ranges.
  const parsed = new Date(`${monthLabel} 1`);
  const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
  const month = Number.isNaN(parsed.getTime()) ? new Date().getMonth() : parsed.getMonth();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'long' });
  const mon = new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'short' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rangeText = `${mon} ${scheduleRange.minDay} – ${mon} ${scheduleRange.maxDay}`;

  const planning = loadingPlan && !batchProgress;
  const creating = !!batchProgress;
  const busy = loadingPlan;
  const withPosts = ideas.filter((i) => postStatusByDay[i.day]).length;
  const remaining = Math.max(0, batchPostCount - monthlyPostCount);
  const usagePct = batchPostCount > 0 ? Math.min(100, (monthlyPostCount / batchPostCount) * 100) : 0;
  const focus = batchStrategy.trim();
  const mix = FORMATS.map((f) => ({ ...f, n: ideas.filter((i) => (i.format || 'Image') === f.key).length }));

  // Open days: in range, no post yet. They frame the plan and pulse while the AI fills them.
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const openDays = days.filter((d) => d >= scheduleRange.minDay && d <= scheduleRange.maxDay && !postStatusByDay[d]);
  const perWeek = Math.max(1, Math.round(batchPostCount / Math.max(1, openDays.length / 7)));
  const ideaDays = new Set(ideas.map((i) => i.day));

  const dayOptionsFor = (current: number) =>
    days
      .filter((d) => d === current || (d >= scheduleRange.minDay && d <= scheduleRange.maxDay))
      .map((d) => ({
        day: d,
        label: `${new Date(year, month, d).toLocaleDateString('en-PH', { weekday: 'short' })}, ${mon} ${d}${
          postStatusByDay[d] ? ' · has a post' : d !== current && ideaDays.has(d) ? ' · has an idea' : ''
        }`,
      }));

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

  const renderIdea = (item: TimelineCardItem) => {
    const index = item.ideaIndex!;
    const idea = ideas[index];
    if (!idea) return null;
    const isCreating = creatingDay === idea.day;
    const passed = idea.day < scheduleRange.minDay; // batch create skips these
    const queued = creating && !isCreating && !passed;
    const chip = isCreating ? { label: 'Creating…', busy: true } : passed ? { label: 'Day passed' } : queued ? { label: 'Queued' } : null;
    return (
      <IdeaCapsule
        idea={idea}
        mon={mon}
        chip={chip}
        locked={creating || planning}
        dayOptions={dayOptionsFor(idea.day)}
        onUpdate={(field, value) => onUpdateIdea(index, field, value)}
        onDelete={() => onDeleteIdea(index)}
        onWrite={() => onOpenDay(idea.day)}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[1280px] flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)] outline-none animate-scale-in motion-reduce:animate-none sm:h-[min(92vh,880px)] sm:rounded-2xl sm:border sm:border-[var(--border-strong)] sm:shadow-2xl"
      >
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-6">
          <h2 id="planning-title" className="font-display text-xl font-bold tracking-tight">Plan your month</h2>
          <span className="rounded-full border border-badge-border bg-badge px-2.5 py-1 text-xs font-bold text-badge-text">{monthLabel}</span>
          <span className="text-xs text-[var(--fg-muted)]">{planLabel} plan</span>
          <div className="ml-auto flex items-center gap-2.5 text-xs text-[var(--fg-muted)]">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--border-strong)]" aria-hidden>
              <b className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${usagePct}%` }} />
            </span>
            <span className="tabular-nums">{monthlyPostCount} of {batchPostCount} posts used</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close planner"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[35fr_65fr] lg:overflow-hidden">
          {/* ── Campaign strategy ── */}
          <aside className="space-y-6 border-b border-[var(--border)] px-5 py-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {trialLimitReached && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300" role="status">
                <CircleAlert className="h-4 w-4 shrink-0" /> You’ve used all {batchPostCount} posts for {monthName}.
                {planLabel !== 'Pro' && (
                  <button type="button" className="ml-auto font-semibold underline" onClick={onOpenBilling}>Upgrade to Pro</button>
                )}
              </div>
            )}

            <section className="space-y-2">
              <label className={LABEL} htmlFor="pl-focus">Focus for {monthName}</label>
              <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-alt)_60%,transparent)] p-4 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-[var(--ring)]">
                <TextareaAutosize
                  id="pl-focus"
                  minRows={3}
                  maxRows={8}
                  value={batchStrategy}
                  onChange={(e) => onStrategyChange(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. “Undas promo for our ube pandesal” or “New branch in Cubao”"
                  className="block w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-[var(--fg-subtle)] disabled:opacity-60"
                />
              </div>
              <p className="text-xs text-[var(--fg-muted)]">Kawayan plans the month around this. Change it any time, then re-plan.</p>
            </section>

            <section className="space-y-2">
              <span className={LABEL} id="pl-presets-label">Starting points</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="pl-presets-label">
                {STRATEGY_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={focus === s}
                    disabled={busy}
                    onClick={() => onStrategyChange(focus === s ? '' : s)}
                    className={clsx(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
                      focus === s
                        ? 'border-brand/60 bg-brand/10 text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <span className={LABEL}>Your progress</span>
              <ol className="space-y-3">
                {flow.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      className={clsx(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                        step.state === 'done' && 'border-transparent bg-brand text-on-brand',
                        step.state === 'busy' && 'border-brand text-[var(--primary)]',
                        step.state === 'active' && 'border-brand text-[var(--primary)]',
                        step.state === 'todo' && 'border-[var(--border-strong)] text-[var(--fg-subtle)]',
                      )}
                    >
                      {step.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step.state === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                    </span>
                    <span className="min-w-0 text-[13px]">
                      <b className={clsx('block font-semibold', step.state === 'todo' && 'text-[var(--fg-muted)]')}>{step.title}</b>
                      <small className="block text-xs text-[var(--fg-muted)]">{step.sub}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                <p className="mb-1 flex items-center justify-between font-semibold text-[var(--fg)]">
                  Target dates <span className="font-display text-[var(--primary)]">{rangeText}</span>
                </p>
                {batchPostCount} ideas across {openDays.length} open day{openDays.length === 1 ? '' : 's'}, about {perWeek} a week
                {days.some((d) => postStatusByDay[d]) && ', around the days that already have posts'}. You can edit every idea before any post is made.
              </div>
            </section>
          </aside>

          {/* ── Multi-channel batch timeline ── */}
          <main className="flex min-w-0 flex-col lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6" aria-live="polite">
              <h3 className="text-[15px] font-bold">
                {planning ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                    Planning {batchPostCount} ideas{focus ? ` around “${focus.length > 40 ? `${focus.slice(0, 40)}…` : focus}”` : ''}
                  </span>
                ) : ideas.length ? (
                  <>{ideas.length} ideas <span className="font-normal text-[var(--fg-muted)]">· {rangeText}</span></>
                ) : (
                  <>{monthName} on your channels</>
                )}
              </h3>
              {ideas.length > 0 && !planning && (
                <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
                  {mix.map((f) => (
                    <span key={f.key} className={clsx('inline-flex items-center gap-1.5', f.n === 0 && 'opacity-50')}>
                      <i className="h-2 w-2 rounded-full" style={{ background: f.color }} /> {f.key} {f.n}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mx-5 mb-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] sm:mx-6">
              <ChannelTimelineTrack
                compact
                currentDate={new Date(year, month, 1)}
                posts={posts}
                ideas={ideas}
                accounts={accounts}
                channels={channels}
                failedIds={failedIds}
                loading={false}
                ghostDays={planning ? openDays : undefined}
                renderIdea={renderIdea}
                onOpenPost={(post) => onOpenDay(Number(post.date.slice(8, 10)))}
                onEditPost={(post) => onOpenDay(Number(post.date.slice(8, 10)))}
                onOpenDay={onOpenDay}
              />
            </div>
          </main>
        </div>

        {/* ── Action bar ── */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--card)] px-5 py-3 sm:px-6">
          <div className="min-w-0 flex-1 text-[13px] text-[var(--fg-muted)] [&_b]:font-semibold [&_b]:text-[var(--fg)]">
            {creating ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  <b>Writing post {Math.min(batchProgress!.current + 1, batchProgress!.total)} of {batchProgress!.total}</b> · captions and visuals
                </span>
                <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--border-strong)]" aria-hidden>
                  <b className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${batchProgress!.total ? (batchProgress!.current / batchProgress!.total) * 100 : 0}%` }} />
                </span>
              </div>
            ) : planning ? (
              <span>This takes about 15 seconds.</span>
            ) : ideas.length === 0 ? (
              <span>Ideas will be dated <b>{rangeText}</b> · {remaining} post{remaining === 1 ? '' : 's'} left in your plan this month.</span>
            ) : createCount > 0 ? (
              <span>
                <b>{createCount} idea{createCount === 1 ? '' : 's'}</b> ready to become drafts · {monthlyPostCount} of {batchPostCount} posts used, {remaining} left
              </span>
            ) : withPosts >= ideas.length ? (
              <span>Every idea has a post. Open any of them to edit or schedule.</span>
            ) : (
              <span>No posts left in your plan this month.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ideas.length === 0 ? (
              <button type="button" className={PRIMARY_BTN} onClick={onGeneratePlan} disabled={busy}>
                {planning ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {planning ? 'Planning…' : `Plan ${batchPostCount} ideas`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGeneratePlan}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--bg-alt)] disabled:opacity-50"
                >
                  {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Re-plan
                </button>
                <button type="button" className={PRIMARY_BTN} onClick={onBatchGenerate} disabled={busy || createCount === 0 || trialLimitReached}>
                  {creating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {creating
                    ? `Creating ${batchProgress!.current}/${batchProgress!.total}…`
                    : createCount === 0
                      ? 'Nothing new to create'
                      : `Approve & create ${createCount} post${createCount === 1 ? '' : 's'}`}
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
