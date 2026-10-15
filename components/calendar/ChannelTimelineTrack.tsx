import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Check, ChevronLeft, ChevronRight, CircleX, Clock, Ellipsis, Layers, Linkedin, PencilLine, Plus, RefreshCw, Settings2, Unplug } from 'lucide-react';
import clsx from 'clsx';
import { ContentIdea, GeneratedPost } from '../../types';
import type { SocialAccount, SocialPlatform } from '../../services/socialService';
import { FacebookGlyph, InstagramGlyph, TikTokGlyph } from '../SocialAccounts';
import type { PostChannels } from '../../utils/workspaceFeed';
import { CardStatus, LaneId, TimelineCardItem, bucketByLane } from './mapCalendarEvents';
import TimelinePostCard from './TimelinePostCard';

const LinkedInGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <Linkedin className={className} color="#0A66C2" strokeWidth={1.75} aria-hidden />
);

const LANES: { id: LaneId; name: string; Glyph?: React.FC<{ className?: string }>; soon?: boolean }[] = [
  { id: 'plan', name: 'Drafts & ideas' },
  { id: 'facebook', name: 'Facebook', Glyph: FacebookGlyph },
  { id: 'instagram', name: 'Instagram', Glyph: InstagramGlyph },
  { id: 'tiktok', name: 'TikTok', Glyph: TikTokGlyph, soon: true },
  { id: 'linkedin', name: 'LinkedIn', Glyph: LinkedInGlyph, soon: true },
];

/** Width of one day on the track, px (compact: the planner). */
const COL = 148;
const COMPACT_COL = 128;

/** Compact posts are pills: solid once posted, tinted while queued, dashed as a draft. */
const PILL: Record<Exclude<CardStatus, 'idea'>, { cls: string; Icon: React.ElementType; label: string }> = {
  published: { cls: 'border-transparent bg-brand text-on-brand', Icon: Check, label: 'Posted' },
  scheduled: { cls: 'border-brand/50 bg-brand/15 text-[var(--primary)]', Icon: Clock, label: 'Scheduled' },
  draft: { cls: 'border-dashed border-[var(--border-strong)] bg-[var(--bg-alt)] text-[var(--fg-muted)]', Icon: PencilLine, label: 'Draft' },
  failed: { cls: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300', Icon: CircleX, label: 'Failed' },
};

const MENU_ITEM =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none data-[highlighted]:bg-[var(--bg-alt)]';

interface Props {
  currentDate: Date;
  posts: GeneratedPost[];
  ideas: ContentIdea[];
  /** null while loading. */
  accounts: SocialAccount[] | null;
  channels: PostChannels;
  failedIds: string[];
  loading: boolean;
  onOpenPost: (post: GeneratedPost) => void;
  onEditPost: (post: GeneratedPost) => void;
  onRetryPost?: (post: GeneratedPost) => void;
  onOpenDay: (day: number) => void;
  onConnect?: (platform: SocialPlatform) => void;
  onDisconnect?: (account: SocialAccount) => void;
  onManageAccounts?: () => void;
  /** Narrow columns, icon-only lane heads and post pills (the month planner). */
  compact?: boolean;
  /** Draws idea cards; without it ideas render as plain timeline cards. */
  renderIdea?: (item: TimelineCardItem) => React.ReactNode;
  /** Days that get a pulsing placeholder in the ideas lane (while the AI plans). */
  ghostDays?: number[];
}

/**
 * The month as one horizontal track: a row per channel, a column per day. Drafts and ideas
 * have not been sent anywhere yet, so they ride in their own lane on top.
 */
const ChannelTimelineTrack: React.FC<Props> = ({
  currentDate, posts, ideas, accounts, channels, failedIds, loading,
  onOpenPost, onEditPost, onRetryPost, onOpenDay, onConnect, onDisconnect, onManageAccounts, compact, renderIdea, ghostDays,
}) => {
  const col = compact ? COMPACT_COL : COL;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const todayIdx = now.getFullYear() === year && now.getMonth() === month ? now.getDate() - 1 : -1;

  const { cells, laneCount } = useMemo(
    () => bucketByLane(posts, ideas, new Date(year, month, 1), channels, accounts ?? [], failedIds),
    [posts, ideas, accounts, channels, failedIds, year, month]
  );

  // Open on today (one day of context to its left), or the 1st for other months.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = todayIdx > 0 ? (todayIdx - 1) * col : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, loading]);

  const scrollWeek = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 7 * col, behavior: 'smooth' });

  if (loading) {
    return (
      <div className="p-3" aria-busy="true" aria-label="Loading your timeline">
        <div className="mb-3 flex gap-3 pl-[132px] sm:pl-[212px]">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-6 flex-1 animate-pulse rounded-md bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] motion-reduce:animate-none" />)}
        </div>
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="flex gap-3 border-t border-[var(--border)] py-3">
            <div className="h-10 w-[120px] shrink-0 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] motion-reduce:animate-none sm:w-[200px]" />
            {Array.from({ length: 6 }, (_, col) => (
              <div
                key={col}
                className={clsx('h-[58px] flex-1 rounded-lg', (row + col) % 3 ? 'animate-pulse bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] motion-reduce:animate-none' : '')}
                style={{ animationDelay: `${col * 80}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const monthShort = currentDate.toLocaleDateString('en-PH', { month: 'short' });

  const laneMeta = (id: LaneId) => {
    const linked = (accounts ?? []).filter((a) => a.platform === id);
    const name = LANES.find((l) => l.id === id)!.name;
    if (id === 'plan') {
      const n = laneCount.get('plan') ?? 0;
      return { linked, sub: n ? `${n} not sent yet` : 'Not sent yet', empty: compact ? 'No ideas yet.' : 'No drafts or ideas this month. Use Plan month, or click a day to write one.' };
    }
    if (id === 'tiktok' || id === 'linkedin') return { linked, sub: 'Coming soon', empty: `Publishing to ${name} is coming soon.` };
    if (accounts === null) return { linked, sub: 'Checking…', empty: '' };
    if (!linked.length) return { linked, sub: 'Not connected', empty: `Connect ${name} to schedule posts here.` };
    return { linked, sub: linked.map((a) => `@${a.username}`).join(', '), empty: `Nothing scheduled to ${name} this month.` };
  };

  return (
    <div ref={scrollRef} className={clsx('relative overflow-x-auto overscroll-x-contain', compact ? '[--head:60px]' : '[--head:128px] sm:[--head:208px]')}>
      <div className="relative grid w-max" style={{ gridTemplateColumns: `var(--head) repeat(${days}, ${col}px)` }}>
        {/* Corner */}
        <div style={{ gridRow: 1, gridColumn: 1 }} className={clsx('sticky left-0 z-30 flex h-12 items-center justify-between gap-1 border-b border-r border-[var(--border)] bg-[var(--card)]', compact ? 'px-0.5' : 'px-3')}>
          {!compact && <span className="hidden text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)] sm:inline">Channels</span>}
          <span className="flex">
            <button type="button" onClick={() => scrollWeek(-1)} aria-label="Earlier week" className="grid h-7 w-7 place-items-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => scrollWeek(1)} aria-label="Later week" className="grid h-7 w-7 place-items-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </span>
        </div>

        {/* Date axis */}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(year, month, i + 1);
          const isToday = i === todayIdx;
          return (
            <div
              key={i}
              style={{ gridRow: 1, gridColumn: i + 2 }}
              className={clsx(
                'flex h-12 items-center gap-1.5 border-b border-l border-[var(--border)] px-3',
                date.getDay() === 1 && 'border-l-[var(--border-strong)]',
                isToday ? 'bg-[var(--today-highlight)] text-[var(--primary)]' : 'text-[var(--fg-muted)]',
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide">{date.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
              <span className={clsx('text-sm font-bold tabular-nums', !isToday && 'text-[var(--fg)]')}>{i + 1}</span>
              {isToday && <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-1.5 text-[10px] font-bold">Today</span>}
            </div>
          );
        })}

        {/* Lanes */}
        {LANES.map((lane, li) => {
          const row = li + 2;
          const meta = laneMeta(lane.id);
          const platform = lane.id as SocialPlatform;
          const live = lane.id === 'facebook' || lane.id === 'instagram';
          const broken = meta.linked.some((a) => !a.isActive);
          return (
            <React.Fragment key={lane.id}>
              <div
                style={{ gridRow: row, gridColumn: 1 }}
                title={compact ? `${lane.name} · ${broken ? 'Needs reconnecting' : meta.sub}` : undefined}
                className={clsx('sticky left-0 z-30 flex items-center gap-2.5 border-r border-t border-[var(--border)] bg-[var(--card)] py-2', compact ? 'justify-center px-1' : 'px-3')}
              >
                <span className={clsx('relative h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-alt)]', compact ? 'grid' : 'hidden sm:grid', compact && lane.soon && 'opacity-50')}>
                  {lane.Glyph ? <lane.Glyph className="h-4 w-4" /> : <Layers className="h-4 w-4 text-[var(--primary)]" strokeWidth={1.75} aria-hidden />}
                  {meta.linked.length > 0 && (
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--card)]', broken ? 'bg-amber-400' : 'bg-[var(--success)]')} aria-hidden />
                  )}
                </span>
                {!compact && <div className={clsx('min-w-0 flex-1', lane.soon && 'opacity-60')}>
                  <p className="truncate text-[13px] font-semibold text-[var(--fg)]">{lane.name}</p>
                  <p className={clsx('truncate text-[11px]', broken ? 'text-amber-600 dark:text-amber-300' : 'text-[var(--fg-muted)]')}>
                    {broken ? 'Needs reconnecting' : meta.sub}
                  </p>
                </div>}
                {!compact && onConnect && live && accounts !== null && meta.linked.length === 0 && (
                  <button type="button" onClick={() => onConnect(platform)} className="shrink-0 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] hover:bg-[var(--bg-alt)]">
                    Connect
                  </button>
                )}
                {!compact && onConnect && live && meta.linked.length > 0 && (
                  <Menu.Root>
                    <Menu.Trigger aria-label={`${lane.name} channel options`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)] data-[popup-open]:bg-[var(--bg-alt)]">
                      <Ellipsis className="h-4 w-4" strokeWidth={2} />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[95]">
                        <Menu.Popup className="min-w-[200px] origin-[var(--transform-origin)] rounded-lg border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-lg transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                          {meta.linked.map((a) => (
                            <Menu.Group key={a.id}>
                              <Menu.GroupLabel className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-[var(--fg-subtle)]">@{a.username}</Menu.GroupLabel>
                              <Menu.Item className={MENU_ITEM} onClick={() => onConnect(platform)}>
                                <RefreshCw className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Reconnect
                              </Menu.Item>
                              <Menu.Item className={clsx(MENU_ITEM, 'text-red-600 dark:text-red-300')} onClick={() => onDisconnect?.(a)}>
                                <Unplug className="h-3.5 w-3.5" aria-hidden /> Disconnect
                              </Menu.Item>
                            </Menu.Group>
                          ))}
                          <Menu.Separator className="my-1 h-px bg-[var(--border)]" />
                          <Menu.Item className={MENU_ITEM} onClick={() => onManageAccounts?.()}>
                            <Settings2 className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Manage accounts
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                )}
              </div>

              {Array.from({ length: days }, (_, i) => {
                const day = i + 1;
                const items = cells.get(`${lane.id}:${day}`) ?? [];
                const weekend = [0, 6].includes(new Date(year, month, day).getDay());
                return (
                  <div
                    key={day}
                    style={{ gridRow: row, gridColumn: i + 2 }}
                    className={clsx(
                      'relative flex flex-col gap-1.5 border-l border-t border-[var(--border)] p-1.5',
                      lane.soon ? 'min-h-[52px]' : compact ? 'min-h-[68px]' : 'min-h-[92px]',
                      new Date(year, month, day).getDay() === 1 && 'border-l-[var(--border-strong)]',
                      i === todayIdx
                        ? 'bg-[var(--today-highlight)]'
                        : weekend && 'bg-[color-mix(in_srgb,var(--bg-alt)_55%,transparent)]',
                    )}
                  >
                    {!lane.soon && (
                      <button
                        type="button"
                        tabIndex={lane.id === 'plan' ? 0 : -1}
                        aria-label={`Write a post for ${monthShort} ${day}`}
                        onClick={() => onOpenDay(day)}
                        className="group absolute inset-0 z-0 flex items-end justify-center rounded-none pb-2 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                      >
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fg-muted)]">
                          <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Add
                        </span>
                      </button>
                    )}
                    {lane.id === 'plan' && ghostDays?.includes(day) && (
                      <span
                        aria-hidden
                        className="h-[52px] animate-pulse rounded-xl border border-dashed border-brand/40 bg-brand/[0.06] motion-reduce:animate-none"
                        style={{ animationDelay: `${(day % 7) * 90}ms` }}
                      />
                    )}
                    {items.map((item) => {
                      if (item.status === 'idea' && renderIdea) return <React.Fragment key={item.key}>{renderIdea(item)}</React.Fragment>;
                      if (compact && item.post) {
                        const pill = PILL[item.status as Exclude<CardStatus, 'idea'>];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => onOpenPost(item.post!)}
                            title={`${item.title} · ${item.time ?? pill.label}`}
                            className={clsx('relative z-10 flex w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold transition-[filter] hover:brightness-110', pill.cls)}
                          >
                            <pill.Icon className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-label={pill.label} />
                            <span className="truncate">{item.title}</span>
                          </button>
                        );
                      }
                      return (
                        <TimelinePostCard
                          key={item.key}
                          item={item}
                          onOpen={() => (item.post ? onOpenPost(item.post) : onOpenDay(day))}
                          onEdit={item.post ? () => onEditPost(item.post!) : undefined}
                          onRetry={item.status === 'failed' && item.post && onRetryPost ? () => onRetryPost(item.post!) : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {!laneCount.get(lane.id) && meta.empty && !(lane.id === 'plan' && ghostDays?.length) && (
                <div style={{ gridRow: row, gridColumn: '2 / -1' }} className="pointer-events-none z-[9] flex items-center">
                  <span className="sticky left-[calc(var(--head)+12px)] mx-3 inline-flex rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--fg-muted)]">
                    {meta.empty}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Now line: from the date axis down through every lane, at the current time of day.
            Above cards (z-20) but under the sticky lane heads (z-30); never takes clicks. */}
        {todayIdx >= 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 top-12 z-20 w-0.5 -translate-x-1/2 bg-[color-mix(in_srgb,var(--primary)_80%,transparent)]"
            style={{ left: `calc(var(--head) + ${(todayIdx + (now.getHours() * 60 + now.getMinutes()) / 1440) * col}px)` }}
          >
            <span className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_var(--today-highlight)]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--primary)] opacity-60 motion-reduce:hidden" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelTimelineTrack;
