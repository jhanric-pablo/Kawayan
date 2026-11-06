import React, { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { CircleDashed, GripVertical, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { FacebookGlyph, InstagramGlyph } from '../SocialAccounts';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import type { GeneratedPost } from '../../types';
import type { TimelineCardItem } from './mapCalendarEvents';

interface Props {
  currentDate: Date;
  byDay: Map<number, TimelineCardItem[]>;
  /** The clicked post's element comes along so the floating card can sit beside it. */
  onOpenPost: (post: GeneratedPost, anchor?: HTMLElement) => void;
  /** Empty day or idea: open the studio for that day. */
  onOpenDay: (day: number) => void;
  onMovePost: (post: GeneratedPost, day: number) => void;
  onMoveIdea: (index: number, day: number) => void;
  /** PH holidays and paydays by day, shown as small tags. */
  tags?: Map<number, string>;
  /** The post open in the details panel gets an outline. */
  selectedPostId?: string | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Only things that haven't gone out can move; scheduled posts are already queued on the pages.
const movable = (i: TimelineCardItem) => i.status === 'draft' || i.status === 'failed' || i.status === 'idea';
const dragId = (i: TimelineCardItem) => (i.post ? `post:${i.post.id}` : `idea:${i.ideaIndex}`);

// Calendar post cards: a status stripe, the thumbnail with its pages on the corner, a two-line title,
// then a short status (or the time, once scheduled). The full title and status are in the tooltip.
const TILE: Record<TimelineCardItem['status'] | 'held', { label: string; short: string; tone: string }> = {
  idea: { label: 'Idea', short: 'Idea', tone: 'is-idea' },
  draft: { label: 'Pending approval', short: 'Approve', tone: 'is-amber' },
  scheduled: { label: 'Scheduled', short: 'Scheduled', tone: 'is-brand' },
  published: { label: 'Published', short: 'Posted', tone: 'is-done' },
  failed: { label: 'Failed', short: 'Failed', tone: 'is-red' },
  held: { label: 'Held: a page lost access', short: 'Held', tone: 'is-red' },
};
const GLYPH: Record<string, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };
const tileStatus = (item: TimelineCardItem) => TILE[item.held ? 'held' : item.status];

const Tile: React.FC<{ item: TimelineCardItem; compact?: boolean; lifted?: boolean; selected?: boolean }> = ({ item, lifted, selected }) => {
  const t = tileStatus(item);
  const pages = (item.platforms || []).filter((pl) => GLYPH[pl]);
  return (
    <span className={clsx('kw-ptile', t.tone, lifted && 'is-lifted', selected && 'is-selected')}>
      <span className="kw-ptile__thumb">
        {item.imageUrl ? <img decoding="async" src={item.imageUrl} alt="" loading="lazy" /> : <span className="kw-ptile__ph"><CircleDashed aria-hidden /></span>}
        {item.status !== 'idea' && pages.length > 0 && (
          <span className="kw-ptile__pages">{pages.map((pl) => { const G = GLYPH[pl]; return <G key={pl} className="h-3 w-3" />; })}</span>
        )}
      </span>
      <span className="kw-ptile__title">{item.title}</span>
      <span className="kw-ptile__status"><i aria-hidden />{item.status === 'scheduled' && item.time && !item.held ? item.time : t.short}</span>
    </span>
  );
};

/**
 * Splits dnd-kit's listeners: pointer and touch go on the whole card (a click still opens it, since a drag
 * only starts after 6px or a long press), the keyboard ones on a small handle that appears when tabbed to.
 */
const dragProps = (listeners: ReturnType<typeof useDraggable>['listeners']) => ({
  card: { onPointerDown: listeners?.onPointerDown as React.PointerEventHandler | undefined, onTouchStart: listeners?.onTouchStart as React.TouchEventHandler | undefined },
  keys: { onKeyDown: listeners?.onKeyDown as React.KeyboardEventHandler | undefined },
});

const KeyHandle: React.FC<{ title: string; attributes: ReturnType<typeof useDraggable>['attributes']; onKeyDown?: React.KeyboardEventHandler }> = ({ title, attributes, onKeyDown }) => (
  <span
    {...attributes}
    onKeyDown={onKeyDown}
    aria-label={`Move “${title}” to another day (Space to pick up, arrows to move, Space to drop)`}
    className="absolute left-1 top-1 z-10 grid h-6 w-5 place-items-center rounded bg-(--card) text-(--fg) opacity-0 focus-visible:opacity-100"
  >
    <GripVertical className="h-3.5 w-3.5" aria-hidden />
  </span>
);

const DraggableTile: React.FC<{ item: TimelineCardItem; compact?: boolean; selected?: boolean; onOpen: (el: HTMLElement) => void }> = ({ item, compact, selected, onOpen }) => {
  const can = movable(item);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `grid:${dragId(item)}`, data: { item }, disabled: !can });
  const drag = dragProps(listeners);
  return (
    <div ref={setNodeRef} data-post-tile {...(can ? drag.card : {})} className={clsx('relative', can && 'cursor-grab active:cursor-grabbing', isDragging && 'opacity-30')}>
      {/* A real tooltip (portaled, so the calendar's edges don't clip it) carries the full title and status. */}
      <Tooltip>
        <TooltipTrigger
          delay={250}
          render={
            <button
              type="button"
              onClick={(e) => onOpen(e.currentTarget)}
              aria-pressed={selected || undefined}
              aria-label={`${item.title}. ${tileStatus(item).label}${item.time ? `, ${item.time}` : ''}`}
              className={clsx('block w-full rounded-md', can && 'cursor-grab active:cursor-grabbing')}
            />
          }
        >
          <Tile item={item} compact={compact} selected={selected} />
        </TooltipTrigger>
        <TooltipContent side="top" className="block max-w-[260px] py-2 leading-snug">
          <span className="block font-medium">{item.title}</span>
          <span className="block opacity-75">{tileStatus(item).label}{item.time ? ` · ${item.time}` : ''}</span>
        </TooltipContent>
      </Tooltip>
      {can && <KeyHandle title={item.title} attributes={attributes} onKeyDown={drag.keys.onKeyDown} />}
    </div>
  );
};

const DayCellBase: React.FC<{
  day: number | null;
  past: boolean;
  today: boolean;
  items: TimelineCardItem[];
  /** e.g. "Wed, Nov 4", for screen readers. */
  label: string;
  tag?: string;
  selectedPostId?: string | null;
  onOpenPost: Props['onOpenPost'];
  onOpenDay: Props['onOpenDay'];
}> = ({ day, past, today, items, label, tag, selectedPostId, onOpenPost, onOpenDay }) => {
  const { setNodeRef, isOver, active } = useDroppable({ id: `day:${day}`, disabled: day === null || past });
  const dropping = isOver && !!active;
  // The whole box writes a post for that day, unless the day has passed or already has its one post.
  const canAdd = day !== null && !past && !items.some((i) => i.post);
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'group/cell relative flex min-h-[92px] flex-col gap-1 border-b border-r border-[color-mix(in_srgb,var(--fg)_7%,transparent)] p-1.5 transition-colors [&:nth-child(7n)]:border-r-0',
        day === null && 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--dot)_6px_7px)]',
        past && day !== null && 'bg-(--muted)/50',
        dropping && 'bg-(--green-soft) ring-2 ring-inset ring-(--green)',
      )}
    >
      {day !== null && (
        <>
          <span className="pointer-events-none relative z-10 flex items-center justify-between">
            <span
              className={clsx(
                'mono grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs font-medium',
                today ? 'bg-(--fg) text-(--bg)' : past ? 'text-(--fg-muted) opacity-70' : 'text-(--fg)',
              )}
            >
              {day}
            </span>
            {tag && <span className="kw-daytag" title={tag}>{tag}</span>}
          </span>
          {canAdd && (
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={`Write a post for ${label}`}
              className="absolute inset-0 z-0 grid place-items-center rounded-none text-(--fg-muted) transition-colors hover:bg-(--muted)/60 focus-visible:bg-(--muted) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--green)"
            >
              {items.length === 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-(--border) bg-(--card) px-2 py-1 text-xs font-medium text-(--fg) opacity-0 transition-opacity group-hover/cell:opacity-100 [@media(hover:none)]:hidden">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> New post
                </span>
              )}
            </button>
          )}
          <AnimatePresence>
            {items.map((item) => (
              <m.div
                key={item.key}
                className="relative z-10"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: Math.min(0.2, (day ?? 0) * 0.006), ease: [0.2, 0.8, 0.2, 1] } }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
              >
                <DraggableTile item={item} compact selected={!!item.post && item.post.id === selectedPostId} onOpen={(el) => (item.post ? onOpenPost(item.post, el) : onOpenDay(item.day))} />
              </m.div>
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

/** Re-renders only when its own day, items or selection change. */
const DayCell = React.memo(DayCellBase);
const NO_ITEMS: TimelineCardItem[] = [];

/**
 * The month at a glance: each post as a picture tile in its day. Unsent drafts and ideas show in
 * their day, in List view, in the Post studio and in the stat cards.
 * Drafts and ideas drag onto another day (mouse, touch or keyboard); past days don't take drops.
 */
const MonthGrid: React.FC<Props> = ({ currentDate, byDay, onOpenPost, onOpenDay, onMovePost, onMoveIdea, tags, selectedPostId }) => {
  const [dragging, setDragging] = useState<TimelineCardItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const todayKey = now.getFullYear() * 400 + now.getMonth() * 32 + now.getDate();
  const keyOf = (d: number) => year * 400 + month * 32 + d;
  const labelFor = (d: number) => new Date(year, month, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.item as TimelineCardItem) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const item = e.active.data.current?.item as TimelineCardItem | undefined;
    const day = Number(String(e.over?.id ?? '').split(':')[1]);
    if (!item || !day || day === item.day) return;
    if (item.post) onMovePost(item.post, day);
    else if (item.ideaIndex != null) onMoveIdea(item.ideaIndex, day);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div>
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-[color-mix(in_srgb,var(--fg)_7%,transparent)]">
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-2.5 py-2 text-xs font-medium text-(--fg-muted)">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => (
              <DayCell
                key={i}
                day={day}
                past={day !== null && keyOf(day) < todayKey}
                today={day !== null && keyOf(day) === todayKey}
                items={day ? byDay.get(day) ?? NO_ITEMS : NO_ITEMS}
                label={day ? labelFor(day) : ''}
                tag={day ? tags?.get(day) : undefined}
                selectedPostId={selectedPostId}
                onOpenPost={onOpenPost}
                onOpenDay={onOpenDay}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {dragging && (
          <m.div className="w-40" initial={{ scale: 1 }} animate={{ scale: 1.03 }} transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}>
            <Tile item={dragging} compact lifted />
          </m.div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default MonthGrid;
