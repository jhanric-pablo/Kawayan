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
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Only things that haven't gone out can move; scheduled posts are already queued on the pages.
const movable = (i: TimelineCardItem) => i.status === 'draft' || i.status === 'failed' || i.status === 'idea';
const dragId = (i: TimelineCardItem) => (i.post ? `post:${i.post.id}` : `idea:${i.ideaIndex}`);

/** The picture-first tile used in day cells, the tray and while dragging. */
const Tile: React.FC<{ item: TimelineCardItem; compact?: boolean; lifted?: boolean }> = ({ item, compact, lifted }) => (
  <span
    className={clsx(
      'group/tile flex w-full gap-2 rounded-md border bg-(--card) p-1 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out',
      compact ? 'flex-col' : 'items-center',
      item.status === 'idea' ? 'border-dashed border-(--border-strong) bg-(--bg-alt)' : 'border-(--border) hover:border-(--border-strong)',
      item.status === 'failed' && 'border-red-500/50',
      !lifted && 'hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)] motion-reduce:hover:translate-y-0',
      lifted && 'shadow-xl ring-2 ring-(--primary)',
    )}
  >
    {item.imageUrl ? (
      <img src={item.imageUrl} alt="" loading="lazy" className={clsx('shrink-0 rounded object-cover', compact ? 'h-14 w-full' : 'h-9 w-9')} />
    ) : (
      <span className={clsx('grid shrink-0 place-items-center rounded bg-(--bg-alt) text-(--fg-subtle)', compact ? 'h-14 w-full' : 'h-9 w-9')}>
        <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
    )}
    <span className="flex min-w-0 flex-1 flex-col gap-1 px-0.5">
      <span className="line-clamp-2 text-xs font-semibold leading-tight text-(--fg)">{item.title}</span>
      <StatusBadge status={item.status} time={item.time} className="self-start" />
    </span>
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
      className={clsx('group/row relative flex w-full min-w-0 cursor-grab items-center rounded-md hover:bg-(--card) active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      <KeyHandle title={item.title} attributes={attributes} onKeyDown={drag.keys.onKeyDown} />
      <span className="relative ml-1 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded" aria-hidden>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center border border-dashed border-(--border-strong) text-(--fg-subtle)">
            <Sparkles className="h-3 w-3" aria-hidden />
          </span>
        )}
      </span>
      <button type="button" onClick={onOpen} title={item.title} className="flex min-w-0 flex-1 cursor-grab items-center gap-2 px-2 py-1.5 text-left active:cursor-grabbing">
        <span className={clsx('min-w-0 flex-1 truncate text-xs', item.status === 'idea' ? 'text-(--fg-muted)' : 'font-semibold text-(--fg)')}>{item.title}</span>
        <span className={clsx('shrink-0 text-2xs font-semibold tabular-nums', failed ? 'text-(--danger)' : 'text-(--fg-subtle)')}>{failed ? 'Failed' : date}</span>
      </button>
    </div>
  );
};

const TrayGroup: React.FC<{ title: string; hint?: string; tone?: 'danger'; items: TimelineCardItem[]; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({
  title, hint, tone, items, open, onToggle, children,
}) =>
  items.length === 0 ? null : (
    <section className="min-w-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left hover:bg-(--card)">
        <ChevronDown className={clsx('h-3.5 w-3.5 text-(--fg-subtle) transition-transform duration-200', !open && '-rotate-90')} aria-hidden />
        <span className={clsx('text-xs font-semibold', tone === 'danger' ? 'text-(--danger)' : 'text-(--fg)')}>{title}</span>
        <span className="ml-auto rounded-full bg-(--bg-alt) px-1.5 text-2xs font-bold tabular-nums text-(--fg-muted)">{items.length}</span>
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
              {hint && <p className="px-2 pb-1 text-2xs text-(--fg-subtle)">{hint}</p>}
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
        'group/cell relative flex min-h-28 flex-col gap-1.5 border-b border-r border-(--border) p-1.5 transition-colors [&:nth-child(7n)]:border-r-0',
        day === null && 'bg-(--bg-alt)/40',
        past && day !== null && 'bg-(--bg-alt)/50',
        dropping && 'bg-(--primary)/10 ring-2 ring-inset ring-(--primary)',
      )}
    >
      {day !== null && (
        <>
          <span className="pointer-events-none relative z-10 flex items-center justify-between">
            <span
              className={clsx(
                'grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums',
                today ? 'bg-(--primary) text-(--on-accent)' : past ? 'text-(--fg-subtle)' : 'text-(--fg-muted)',
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
              className="absolute inset-0 z-0 grid place-items-center rounded-none text-(--primary) transition-colors hover:bg-(--primary)/6 focus-visible:bg-(--primary)/8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--primary)"
            >
              {items.length === 0 && (
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold opacity-0 transition-opacity group-hover/cell:opacity-100 [@media(hover:none)]:hidden">
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
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, delay: Math.min(0.3, (day ?? 0) * 0.01), ease: [0.2, 0.8, 0.2, 1] } }}
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
const MonthGrid: React.FC<Props> = ({ currentDate, byDay, unsent, postsLimitText, onOpenPost, onOpenDay, onMovePost, onMoveIdea }) => {
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
      <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden min-w-0 flex-col border-r border-(--border) bg-(--bg) lg:flex" aria-label="Not sent yet" data-tour="unsent-tray">
          <p className="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-(--fg-subtle)">
            Not sent yet <span className="tabular-nums">{unsent.length}</span>
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
              <span key={d} className="px-2 py-2 text-2xs font-bold uppercase tracking-wider text-(--fg-subtle)">{d}</span>
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

      <DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' }}>
        {dragging && (
          <m.div className="w-40" initial={{ scale: 1, rotate: 0 }} animate={{ scale: 1.05, rotate: -2 }} transition={{ type: 'spring', stiffness: 480, damping: 26 }}>
            <Tile item={dragging} compact lifted />
          </m.div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default MonthGrid;
