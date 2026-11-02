import React, { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronDown, GripVertical, Plus, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import type { GeneratedPost } from '../../types';
import { StatusBadge } from './TimelinePostCard';
import type { TimelineCardItem } from './mapCalendarEvents';

interface Props {
  currentDate: Date;
  byDay: Map<number, TimelineCardItem[]>;
  unsent: TimelineCardItem[];
  postsLimitText?: React.ReactNode;
  onOpenPost: (post: GeneratedPost) => void;
  /** Empty day or idea: open the studio for that day. */
  onOpenDay: (day: number) => void;
  onMovePost: (post: GeneratedPost, day: number) => void;
  onMoveIdea: (index: number, day: number) => void;
  /** Hide the "Not sent yet" tray (while post details sit beside the calendar). */
  hideTray?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Only things that haven't gone out can move; scheduled posts are already queued on the pages.
const movable = (i: TimelineCardItem) => i.status === 'draft' || i.status === 'failed' || i.status === 'idea';
const dragId = (i: TimelineCardItem) => (i.post ? `post:${i.post.id}` : `idea:${i.ideaIndex}`);

const CHIP_TONE: Record<TimelineCardItem['status'], string> = {
  idea: 'border-dashed border-(--border) bg-(--muted) text-(--fg-muted)',
  draft: 'border-dashed border-(--border-strong) bg-(--card)',
  scheduled: 'border-(--border) bg-(--card)',
  published: 'border-transparent bg-(--green-soft)',
  failed: 'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-(--card)',
};
const CHIP_LABEL: Record<TimelineCardItem['status'], string> = { idea: 'Idea', draft: 'Draft', scheduled: 'Scheduled', published: 'Posted', failed: 'Failed' };

/** The post chip used in day cells and while dragging (mockup .pchip): thumbnail, title, time or status. */
const Tile: React.FC<{ item: TimelineCardItem; compact?: boolean; lifted?: boolean }> = ({ item, lifted }) => (
  <span
    className={clsx(
      'group/tile flex w-full items-center gap-1.5 rounded-[7px] border py-[3px] pl-[3px] pr-1.5 text-left transition-colors duration-150 hover:bg-(--muted)',
      CHIP_TONE[item.status],
      lifted && 'shadow-lg outline-2 outline-(--fg)',
    )}
  >
    {item.imageUrl ? (
      <img src={item.imageUrl} alt="" loading="lazy" className="h-[22px] w-[22px] shrink-0 rounded object-cover" />
    ) : (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded bg-(--muted) text-(--fg-muted)">
        <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
      </span>
    )}
    <span className={clsx('min-w-0 flex-1 truncate text-xs font-medium', item.status === 'idea' ? 'text-(--fg-muted)' : 'text-(--fg)')}>{item.title}</span>
    {item.time && item.status !== 'idea' ? (
      <time
        className={clsx(
          'mono shrink-0 text-2xs',
          item.status === 'published' ? 'text-(--green-ink)' : item.status === 'failed' ? 'text-(--danger)' : 'text-(--fg-muted)',
        )}
      >
        {item.time}
      </time>
    ) : null}
    <span className="sr-only">{CHIP_LABEL[item.status]}</span>
  </span>
);

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

const DraggableTile: React.FC<{ item: TimelineCardItem; compact?: boolean; onOpen: () => void }> = ({ item, compact, onOpen }) => {
  const can = movable(item);
  // The tray shows unsent items too, so grid copies get their own drag id.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `grid:${dragId(item)}`, data: { item }, disabled: !can });
  const drag = dragProps(listeners);
  return (
    <div ref={setNodeRef} {...(can ? drag.card : {})} className={clsx('relative', can && 'cursor-grab active:cursor-grabbing', isDragging && 'opacity-30')}>
      <button type="button" onClick={onOpen} className={clsx('block w-full rounded-md', can && 'cursor-grab active:cursor-grabbing')} title={item.title}>
        <Tile item={item} compact={compact} />
      </button>
      {can && <KeyHandle title={item.title} attributes={attributes} onKeyDown={drag.keys.onKeyDown} />}
    </div>
  );
};

/** One line in the tray: small picture, title, date. Grab the handle (or the picture) to drag it onto a day. */
const TrayRow: React.FC<{ item: TimelineCardItem; date: string; onOpen: () => void }> = ({ item, date, onOpen }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tray:${dragId(item)}`, data: { item } });
  const drag = dragProps(listeners);
  const failed = item.status === 'failed';
  return (
    <div
      ref={setNodeRef}
      {...drag.card}
      className={clsx('group/row relative flex w-full min-w-0 cursor-grab items-center rounded-md hover:bg-(--muted) active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      <KeyHandle title={item.title} attributes={attributes} onKeyDown={drag.keys.onKeyDown} />
      <span className="relative ml-1 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded" aria-hidden>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center border border-dashed border-(--border-strong) text-(--fg-muted)">
            <Sparkles className="h-3 w-3" aria-hidden />
          </span>
        )}
      </span>
      <button type="button" onClick={onOpen} title={item.title} className="flex min-w-0 flex-1 cursor-grab items-center gap-2 px-2 py-1.5 text-left active:cursor-grabbing">
        <span className={clsx('min-w-0 flex-1 truncate text-xs', item.status === 'idea' ? 'text-(--fg-muted)' : 'font-medium text-(--fg)')}>{item.title}</span>
        <span className={clsx('mono shrink-0 text-2xs', failed ? 'text-(--danger)' : 'text-(--fg-muted)')}>{failed ? 'Failed' : date}</span>
      </button>
    </div>
  );
};

const TrayGroup: React.FC<{ title: string; hint?: string; tone?: 'danger'; items: TimelineCardItem[]; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({
  title, hint, tone, items, open, onToggle, children,
}) =>
  items.length === 0 ? null : (
    <section className="min-w-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left hover:bg-(--muted)">
        <ChevronDown className={clsx('h-3.5 w-3.5 text-(--fg-muted) transition-transform duration-200', !open && '-rotate-90')} aria-hidden />
        <span className={clsx('text-xs font-medium', tone === 'danger' ? 'text-(--danger)' : 'text-(--fg)')}>{title}</span>
        <span className="mono ml-auto rounded-full bg-(--muted) px-1.5 text-2xs font-medium text-(--fg-muted)">{items.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 grid min-w-0 grid-cols-1 gap-px">
              {hint && <p className="px-2 pb-1 text-2xs text-(--fg-muted)">{hint}</p>}
              <AnimatePresence initial={false}>{children}</AnimatePresence>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );

const DayCell: React.FC<{
  day: number | null;
  past: boolean;
  today: boolean;
  items: TimelineCardItem[];
  /** e.g. "Wed, Nov 4", for screen readers. */
  label: string;
  onOpenPost: Props['onOpenPost'];
  onOpenDay: Props['onOpenDay'];
}> = ({ day, past, today, items, label, onOpenPost, onOpenDay }) => {
  const { setNodeRef, isOver, active } = useDroppable({ id: `day:${day}`, disabled: day === null || past });
  const dropping = isOver && !!active;
  // The whole box writes a post for that day, unless the day has passed or already has its one post.
  const canAdd = day !== null && !past && !items.some((i) => i.post);
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'group/cell relative flex min-h-[108px] flex-col gap-1 border-b border-r border-(--border) p-1.5 transition-colors [&:nth-child(7n)]:border-r-0',
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
                today ? 'bg-(--green) text-(--green-fg)' : past ? 'text-(--fg-muted) opacity-70' : 'text-(--fg)',
              )}
            >
              {day}
            </span>
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
                <DraggableTile item={item} compact onOpen={() => (item.post ? onOpenPost(item.post) : onOpenDay(item.day))} />
              </m.div>
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

/**
 * The month at a glance: each post as a picture tile in its day, and a tray of what hasn't gone out yet.
 * Drafts and ideas drag onto another day (mouse, touch or keyboard); past days don't take drops.
 */
const MonthGrid: React.FC<Props> = ({ currentDate, byDay, unsent, postsLimitText, onOpenPost, onOpenDay, onMovePost, onMoveIdea, hideTray }) => {
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
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  // Overdue first (it needs action), then the coming week; everything else stays folded.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysFromToday = (d: number) => Math.round((new Date(year, month, d).getTime() - midnight) / 864e5);
  const groups = {
    overdue: unsent.filter((i) => i.status === 'failed' || (i.status !== 'idea' && daysFromToday(i.day) < 0)),
    week: unsent.filter((i) => i.status !== 'failed' && daysFromToday(i.day) >= 0 && daysFromToday(i.day) < 7),
    later: unsent.filter((i) => i.status !== 'failed' && (daysFromToday(i.day) >= 7 || (i.status === 'idea' && daysFromToday(i.day) < 0))),
  };
  const [open, setOpen] = useState<Record<keyof typeof groups, boolean | undefined>>({ overdue: undefined, week: undefined, later: undefined });
  const isOpen = (g: keyof typeof groups) => open[g] ?? (g !== 'later' || (!groups.overdue.length && !groups.week.length));
  const toggle = (g: keyof typeof groups) => setOpen((o) => ({ ...o, [g]: !isOpen(g) }));
  const rows = (list: TimelineCardItem[]) =>
    list.map((item) => (
      <m.div
        key={`tray-${item.key}`}
        layout="position"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24, height: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <TrayRow
          item={item}
          date={new Date(year, month, item.day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          onOpen={() => (item.post ? onOpenPost(item.post) : onOpenDay(item.day))}
        />
      </m.div>
    ));

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
      <div className={clsx('grid', !hideTray && 'lg:grid-cols-[15rem_minmax(0,1fr)]')}>
        <aside className={clsx('hidden min-w-0 flex-col border-r border-(--border) bg-(--card)', !hideTray && 'lg:flex')} aria-label="Not sent yet" data-tour="unsent-tray">
          <p className="eyebrow flex items-center justify-between px-3 pb-1 pt-3 text-(--fg-muted)">
            Not sent yet <span>{unsent.length}</span>
          </p>
          <div className="flex max-h-[42rem] min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
            {unsent.length === 0 ? (
              <p className="m-1 rounded-md border border-dashed border-(--border) p-3 text-xs text-(--fg-muted)">
                Everything this month is scheduled or posted.
              </p>
            ) : (
              <>
                <TrayGroup title="Overdue" tone="danger" hint="Their day passed. Drag them to a new day." items={groups.overdue} open={isOpen('overdue')} onToggle={() => toggle('overdue')}>
                  {rows(groups.overdue)}
                </TrayGroup>
                <TrayGroup title="This week" items={groups.week} open={isOpen('week')} onToggle={() => toggle('week')}>
                  {rows(groups.week)}
                </TrayGroup>
                <TrayGroup title="Later" items={groups.later} open={isOpen('later')} onToggle={() => toggle('later')}>
                  {rows(groups.later)}
                </TrayGroup>
              </>
            )}
          </div>
          {postsLimitText && <div className="border-t border-(--border) px-3 py-2.5 text-xs text-(--fg-muted)">{postsLimitText}</div>}
        </aside>

        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-(--border)">
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
                items={day ? byDay.get(day) ?? [] : []}
                label={day ? new Date(year, month, day).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
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
