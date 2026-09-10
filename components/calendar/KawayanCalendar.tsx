import React, { useEffect, useMemo, useRef, useState } from 'react';
import Calendar from '@toast-ui/calendar';
import type { Options } from '@toast-ui/calendar';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';

import { ContentIdea, GeneratedPost } from '../../types';
import { buildCalendarItems, itemsToCalendarEvents, KawayanEvent } from './mapCalendarEvents';
import AgendaView from './AgendaView';
import './kawayanCalendar.css';

/** Minimal shapes for the two TOAST callbacks we consume (its shipped
 *  `ExternalEventTypes` indexed-access resolves to `unknown` under this tsconfig). */
interface SelectDateTimeInfo {
  start: Date | string | number;
  end: Date | string | number;
  isAllday: boolean;
}
type CalendarInfo = NonNullable<Options['calendars']>[number];

interface Props {
  currentDate: Date;
  posts: GeneratedPost[];
  ideas: ContentIdea[];
  selectedDay: number | null;
  viewMode: 'grid' | 'list';
  calendarDataVersion?: number;
  onDayClick: (day: number) => void;
  onMonthChange?: (date: Date) => void;
  onAddOn?: (day: number) => void;
}

/* ── Status colours: expressed through TOAST's calendar (calendarId) system ── */
const LIGHT_CALENDARS: CalendarInfo[] = [
  { id: 'idea', name: 'Idea', backgroundColor: '#FBF0E4', borderColor: '#E07B2A', color: '#7A4A1E', dragBackgroundColor: '#FBF0E4' },
  { id: 'draft', name: 'Draft', backgroundColor: '#EDF1EF', borderColor: '#7C8F79', color: '#3A473F', dragBackgroundColor: '#EDF1EF' },
  { id: 'scheduled', name: 'Scheduled', backgroundColor: '#E4EEE8', borderColor: '#2B5748', color: '#1A3D30', dragBackgroundColor: '#E4EEE8' },
  { id: 'published', name: 'Published', backgroundColor: '#E1F0E5', borderColor: '#22A55E', color: '#14603B', dragBackgroundColor: '#E1F0E5' },
];

const DARK_CALENDARS: CalendarInfo[] = [
  { id: 'idea', name: 'Idea', backgroundColor: 'rgba(224,123,42,0.16)', borderColor: '#E9A264', color: '#F3CBA0', dragBackgroundColor: 'rgba(224,123,42,0.16)' },
  { id: 'draft', name: 'Draft', backgroundColor: 'rgba(156,176,128,0.13)', borderColor: '#9CB080', color: '#CBD8C1', dragBackgroundColor: 'rgba(156,176,128,0.13)' },
  { id: 'scheduled', name: 'Scheduled', backgroundColor: 'rgba(43,87,72,0.42)', borderColor: '#9CB080', color: '#E3EFE8', dragBackgroundColor: 'rgba(43,87,72,0.42)' },
  { id: 'published', name: 'Published', backgroundColor: 'rgba(34,165,94,0.22)', borderColor: '#4ED88A', color: '#BEEBCF', dragBackgroundColor: 'rgba(34,165,94,0.22)' },
];

/*
 * NOTE: we deliberately do NOT pass a `theme` to TOAST. Its v2 theme store
 * mutates a shared module-level default object (`mergeObject(DEFAULT_*_THEME, …)`)
 * which immer then freezes — so the *second* Calendar instance on a page
 * (e.g. React StrictMode's mount → unmount → remount) throws
 * "Cannot assign to read only property". All calendar visuals are handled in
 * kawayanCalendar.css instead; only per-status colours go through `calendars`
 * (a safe, non-merging code path).
 */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/* Compact, text-only event chip: status tag + title. No images. */
const monthTemplates: NonNullable<Options['template']> = {
  allday(event) {
    const raw = (event.raw ?? {}) as { statusLabel?: string; status?: string; day?: number };
    const label = escapeHtml(String(raw.statusLabel ?? ''));
    const title = escapeHtml(String(event.title ?? ''));
    const status = escapeHtml(String(raw.status ?? 'draft'));
    const day = Number.isFinite(raw.day) ? String(raw.day) : '';
    return `<span class="kw-evt kw-evt--${status}" data-day="${day}"><span class="kw-evt__tag">${label}</span><span class="kw-evt__title">${title}</span></span>`;
  },
  monthGridHeader(cell) {
    const day = parseInt(cell.date.split('-')[2], 10);
    const mods = [cell.isToday ? 'kw-daynum--today' : '', cell.isOtherMonth ? 'kw-daynum--other' : '']
      .filter(Boolean)
      .join(' ');
    return `<span class="kw-daynum ${mods}" data-ymd="${cell.date}">${day}</span>`;
  },
  monthGridHeaderExceed(hidden) {
    return `<span class="kw-more">+${hidden}</span>`;
  },
  monthMoreClose() {
    return '<span class="kw-more-close">Close</span>';
  },
};

// TOAST freezes the option objects it receives (immer) and normalises colours
// in place — always hand it fresh copies, never the module-level constants.
const freshMonthOptions = (): Options['month'] => ({
  startDayOfWeek: 0,
  isAlways6Weeks: true,
  narrowWeekend: false,
  visibleEventCount: 3,
  dayNames: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
});

const freshCalendars = (dark: boolean): CalendarInfo[] =>
  (dark ? DARK_CALENDARS : LIGHT_CALENDARS).map((c) => ({ ...c }));

/** Watches the `dark` class on <html> so the calendar theme follows the app. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const KawayanCalendar: React.FC<Props> = ({
  currentDate,
  posts,
  ideas,
  selectedDay,
  viewMode,
  calendarDataVersion = 0,
  onDayClick,
}) => {
  const isDark = useIsDark();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<Calendar | null>(null);

  // Keep callbacks / values fresh for the imperatively-bound TOAST listeners.
  const onDayClickRef = useRef(onDayClick);
  const currentDateRef = useRef(currentDate);
  const selectedDayRef = useRef(selectedDay);
  onDayClickRef.current = onDayClick;
  currentDateRef.current = currentDate;
  selectedDayRef.current = selectedDay;

  const items = useMemo(
    () => buildCalendarItems(posts, ideas, currentDate),
    // calendarDataVersion bumps whenever posts/ideas mutate in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, ideas, currentDate, calendarDataVersion]
  );
  const events = useMemo<KawayanEvent[]>(() => itemsToCalendarEvents(items), [items]);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  /* ── Selected-day highlight (TOAST has no month "selected date" concept) ── */
  const syncSelection = () => {
    const root = rootRef.current;
    if (!root) return;
    const day = selectedDayRef.current;
    const cur = currentDateRef.current;
    const want =
      day == null
        ? null
        : `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const current = root.querySelector<HTMLElement>('.toastui-calendar-daygrid-cell.kw-cell-selected');
    const currentYmd = current?.querySelector('.kw-daynum')?.getAttribute('data-ymd') ?? null;
    if (currentYmd === want) return;

    current?.classList.remove('kw-cell-selected');
    if (want) {
      root
        .querySelector(`.kw-daynum[data-ymd="${want}"]`)
        ?.closest('.toastui-calendar-daygrid-cell')
        ?.classList.add('kw-cell-selected');
    }
  };

  const handleSelectDateTime = (info: SelectDateTimeInfo) => {
    calRef.current?.clearGridSelections();
    const start = new Date(info.start);
    const cur = currentDateRef.current;
    if (start.getMonth() === cur.getMonth() && start.getFullYear() === cur.getFullYear()) {
      onDayClickRef.current(start.getDate());
    }
  };

  /* Reliable clicks: TOAST's month `selectDateTime` only fires on a drag-select
     and its `clickEvent` needs a full pointer sequence — so we delegate every
     grid click ourselves (event chips carry `data-day`; empty cells carry ymd). */
  const handleRootClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.toastui-calendar-grid-cell-more-events, .toastui-calendar-see-more')) return;

    const chip = target.closest<HTMLElement>('.kw-evt[data-day]');
    if (chip) {
      const day = Number(chip.dataset.day);
      if (Number.isFinite(day) && day > 0) onDayClickRef.current(day);
      return;
    }

    const cell = target.closest('.toastui-calendar-daygrid-cell');
    const ymd = cell?.querySelector('.kw-daynum')?.getAttribute('data-ymd');
    if (!ymd) return;
    const [y, m, d] = ymd.split('-').map(Number);
    const cur = currentDateRef.current;
    if (m - 1 === cur.getMonth() && y === cur.getFullYear()) {
      onDayClickRef.current(d);
    }
  };

  /* ── Create / destroy the TOAST instance (grid mode only) ── */
  useEffect(() => {
    if (viewMode !== 'grid' || !containerRef.current) return;

    const cal = new Calendar(containerRef.current, {
      defaultView: 'month',
      isReadOnly: false,
      usageStatistics: false,
      useFormPopup: false,
      useDetailPopup: false,
      month: freshMonthOptions(),
      gridSelection: { enableDblClick: false, enableClick: true },
      calendars: freshCalendars(isDark),
      template: monthTemplates,
    });
    calRef.current = cal;

    cal.on('selectDateTime', handleSelectDateTime);
    cal.setDate(currentDateRef.current);
    cal.createEvents(eventsRef.current as unknown as Parameters<Calendar['createEvents']>[0]);

    const rootEl = rootRef.current;
    rootEl?.addEventListener('click', handleRootClick);

    const applyLater = window.setTimeout(syncSelection, 0);
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncSelection);
    });
    if (rootEl) obs.observe(rootEl, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(applyLater);
      cancelAnimationFrame(raf);
      obs.disconnect();
      rootEl?.removeEventListener('click', handleRootClick);
      cal.destroy();
      calRef.current = null;
    };
    // Re-create only when we switch between grid and list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  /* ── Sync events on data change ── */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const cal = calRef.current;
    if (!cal) return;
    cal.clear();
    cal.createEvents(events as unknown as Parameters<Calendar['createEvents']>[0]);
    window.setTimeout(syncSelection, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, viewMode]);

  /* ── Follow the month controlled by the parent toolbar ──
     (the parent owns `currentDate`; TOAST has no internal month nav, so there
     is nothing to report back through `onMonthChange`.) */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const cal = calRef.current;
    if (!cal) return;
    cal.setDate(currentDate);
    window.setTimeout(syncSelection, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);

  /* ── Selection highlight on selectedDay change ── */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const id = window.setTimeout(syncSelection, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, viewMode]);

  /* ── Dark-mode: swap only per-status calendar colours (safe path) ── */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const cal = calRef.current;
    if (!cal) return;
    cal.setCalendars(freshCalendars(isDark));
    window.setTimeout(syncSelection, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, viewMode]);

  return (
    <div ref={rootRef} className={`kw-cal kw-cal--${viewMode}${isDark ? ' kw-cal--dark' : ''}`}>
      {viewMode === 'grid' ? (
        <div ref={containerRef} style={{ height: '100%' }} />
      ) : (
        <AgendaView
          items={items}
          currentDate={currentDate}
          selectedDay={selectedDay}
          onDayClick={(day) => onDayClickRef.current(day)}
        />
      )}
    </div>
  );
};

export default KawayanCalendar;
