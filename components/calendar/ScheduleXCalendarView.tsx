import React, { useEffect, useMemo, useRef } from 'react';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import {
  createViewMonthGrid,
  createViewMonthAgenda,
  viewMonthGrid,
  viewMonthAgenda,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import '@schedule-x/theme-default/dist/index.css';
import 'temporal-polyfill/global';

import { ContentIdea, GeneratedPost } from '../../types';
import { mapToScheduleXEvents, plainDateFromParts } from './mapScheduleXEvents';
import KawayanMonthGridEvent from './KawayanMonthGridEvent';
import './scheduleXTheme.css';

interface Props {
  currentDate: Date;
  posts: GeneratedPost[];
  ideas: ContentIdea[];
  selectedDay: number | null;
  viewMode: 'grid' | 'list';
  calendarDataVersion?: number;
  onDayClick: (day: number) => void;
  onMonthChange: (date: Date) => void;
  onAddOn: (day: number) => void;
}

const EmptyHeader: React.FC = () => null;

const ScheduleXCalendarView: React.FC<Props> = ({
  currentDate,
  posts,
  ideas,
  selectedDay,
  viewMode,
  calendarDataVersion = 0,
  onDayClick,
  onMonthChange,
  onAddOn,
}) => {
  const eventsService = useMemo(() => createEventsServicePlugin(), []);
  const calendarControls = useMemo(() => createCalendarControlsPlugin(), []);

  const onDayClickRef = useRef(onDayClick);
  const onMonthChangeRef = useRef(onMonthChange);
  const onAddOnRef = useRef(onAddOn);
  const currentDateRef = useRef(currentDate);
  const postsRef = useRef(posts);
  const ideasRef = useRef(ideas);
  const isParentNavigatingRef = useRef(false);
  const lastSyncedRef = useRef('');

  onDayClickRef.current = onDayClick;
  onMonthChangeRef.current = onMonthChange;
  onAddOnRef.current = onAddOn;
  currentDateRef.current = currentDate;
  postsRef.current = posts;
  ideasRef.current = ideas;

  const monthGridView = useMemo(() => createViewMonthGrid(), []);
  const monthAgendaView = useMemo(() => createViewMonthAgenda(), []);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const calendarConfig = useMemo(
    () => ({
      views: [monthGridView, monthAgendaView],
      defaultView: viewMonthGrid.name,
      selectedDate: plainDateFromParts(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        selectedDay ?? Math.min(currentDate.getDate(), 28)
      ),
      firstDayOfWeek: 7 as const, // Sunday — matches previous calendar
      locale: 'en-US',
      isDark,
      isResponsive: false,
      monthGridOptions: { nEventsPerDay: 2 },
      calendars: {
        post: {
          colorName: 'post',
          lightColors: {
            main: '#2B5748',
            container: 'rgba(43, 87, 72,0.12)',
            onContainer: '#273338',
          },
          darkColors: {
            main: '#9CB080',
            container: 'rgba(43, 87, 72, 0.4)',
            onContainer: '#FFFFFF',
          },
        },
        idea: {
          colorName: 'idea',
          lightColors: {
            main: '#618764',
            container: 'rgba(156, 176, 128, 0.25)',
            onContainer: '#273338',
          },
          darkColors: {
            main: '#9CB080',
            container: 'rgba(43, 87, 72, 0.5)',
            onContainer: '#FFFFFF',
          },
        },
      },
      events: mapToScheduleXEvents(posts, ideas, currentDate),
      callbacks: {
        onClickDate(date: Temporal.PlainDate) {
          if (date.month - 1 !== currentDateRef.current.getMonth()) return;
          if (hasContentForDay(date.day)) {
            onDayClickRef.current(date.day);
          }
        },
        onEventClick(calendarEvent: { start: Temporal.PlainDate | Temporal.ZonedDateTime }) {
          const day =
            calendarEvent.start instanceof Temporal.PlainDate
              ? calendarEvent.start.day
              : calendarEvent.start.day;
          onDayClickRef.current(day);
        },
        onRangeUpdate(range: { start: Temporal.ZonedDateTime }) {
          if (isParentNavigatingRef.current) return;
          const start = range.start.toPlainDate();
          const cur = currentDateRef.current;
          if (start.year !== cur.getFullYear() || start.month - 1 !== cur.getMonth()) {
            onMonthChangeRef.current(new Date(start.year, start.month - 1, 1));
          }
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthGridView, monthAgendaView, isDark]
  );

  const calendar = useCalendarApp(calendarConfig, [eventsService, calendarControls]);

  // Sync events when data changes
  useEffect(() => {
    if (!eventsService) return;
    eventsService.set(mapToScheduleXEvents(posts, ideas, currentDate));
  }, [posts, ideas, currentDate, eventsService, calendarDataVersion]);

  // Sync visible month from parent toolbar arrows / date input.
  // calendarControls.setDate() requires a Temporal.PlainDate — not an ISO string.
  useEffect(() => {
    if (!calendarControls || !calendar) return;

    const year = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(Math.max(selectedDay ?? 1, 1), daysInMonth);
    const target = plainDateFromParts(year, monthIndex, day);
    const syncKey = `${target.year}-${target.month}-${target.day}`;
    if (syncKey === lastSyncedRef.current) return;

    try {
      const existing = calendarControls.getDate();
      if (
        existing &&
        existing.year === target.year &&
        existing.month === target.month &&
        existing.day === target.day
      ) {
        lastSyncedRef.current = syncKey;
        return;
      }
    } catch {
      // Calendar plugin not fully mounted yet — proceed with setDate below.
    }

    lastSyncedRef.current = syncKey;
    isParentNavigatingRef.current = true;
    calendarControls.setDate(target);
    queueMicrotask(() => {
      isParentNavigatingRef.current = false;
    });
  }, [currentDate, selectedDay, calendarControls, calendar]);

  // Grid vs list view toggle
  useEffect(() => {
    if (!calendarControls) return;
    calendarControls.setView(viewMode === 'grid' ? viewMonthGrid.name : viewMonthAgenda.name);
  }, [viewMode, calendarControls]);

  const hasContentForDay = (day: number) => {
    const month = currentDateRef.current.getMonth();
    const year = currentDateRef.current.getFullYear();
    return (
      postsRef.current.some((p) => {
        const [y, m, d] = p.date.split('-').map(Number);
        return d === day && m - 1 === month && y === year;
      }) || ideasRef.current.some((i) => i.day === day)
    );
  };

  // Inject ADD pill buttons on vacant month-grid cells
  useEffect(() => {
    const root = document.querySelector('.kawayan-schedule-x');
    if (!root) return;

    const injectAddButtons = () => {
      const dayCells = root.querySelectorAll('.sx__month-grid-day');
      dayCells.forEach((cell) => {
        if (
          cell.classList.contains('sx__month-grid-day--is-leading-or-trailing') ||
          cell.classList.contains('sx__month-grid-day--leading') ||
          cell.classList.contains('sx__month-grid-day--trailing')
        ) {
          return;
        }

        const dateEl = cell.querySelector('.sx__month-grid-day__header-date');
        const day = parseInt(dateEl?.textContent?.trim() || '', 10);
        if (!day || Number.isNaN(day)) return;

        const existingBtn = cell.querySelector('.kawayan-add-btn');
        if (hasContentForDay(day)) {
          existingBtn?.remove();
          return;
        }

        if (existingBtn) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kawayan-add-btn';
        btn.textContent = 'ADD';
        btn.title = 'Add single post ($1.50)';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          onAddOnRef.current(day);
        });
        cell.appendChild(btn);
      });
    };

    const timer = window.setTimeout(injectAddButtons, 60);
    const observer = new MutationObserver(() => injectAddButtons());
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      root.querySelectorAll('.kawayan-add-btn').forEach((btn) => btn.remove());
    };
  }, [posts, ideas, currentDate, viewMode]);

  const customComponents = useMemo(
    () => ({
      headerContent: EmptyHeader,
      monthGridEvent: KawayanMonthGridEvent,
      monthAgendaEvent: KawayanMonthGridEvent,
    }),
    []
  );

  if (!calendar) return null;

  return (
    <div className="kawayan-schedule-x w-full min-h-[70vh] lg:min-h-[85vh] overflow-hidden">
      <ScheduleXCalendar calendarApp={calendar} customComponents={customComponents} />
    </div>
  );
};

export default ScheduleXCalendarView;
