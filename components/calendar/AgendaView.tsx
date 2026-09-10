import React, { useMemo } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { KawayanCalendarItem, KawayanStatus } from './mapCalendarEvents';

interface Props {
  items: KawayanCalendarItem[];
  currentDate: Date;
  selectedDay: number | null;
  onDayClick: (day: number) => void;
}

const STATUS_ORDER: Record<KawayanStatus, number> = { idea: 0, draft: 1, scheduled: 2, published: 3 };

/**
 * Month agenda / list view — the same posts + ideas as the grid, grouped by day.
 * Text-focused, no thumbnails. Replaces Schedule-X's month-agenda view.
 */
const AgendaView: React.FC<Props> = ({ items, currentDate, selectedDay, onDayClick }) => {
  const groups = useMemo(() => {
    const byDay = new Map<number, KawayanCalendarItem[]>();
    items.forEach((item) => {
      const list = byDay.get(item.day) ?? [];
      list.push(item);
      byDay.set(item.day, list);
    });
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, list]) => ({
        day,
        list: [...list].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
      }));
  }, [items]);

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  if (groups.length === 0) {
    return (
      <div className="kw-agenda kw-agenda--empty">
        <CalendarPlus className="w-6 h-6" aria-hidden />
        <p className="kw-agenda__empty-title">Nothing planned for {monthLabel}</p>
        <p className="kw-agenda__empty-hint">Pick a day in the grid, or use AI Content Planning to draft a month.</p>
      </div>
    );
  }

  return (
    <ul className="kw-agenda" aria-label={`Agenda for ${monthLabel}`}>
      {groups.map(({ day, list }) => {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const weekday = dateObj.toLocaleDateString('default', { weekday: 'short' });
        const isSelected = selectedDay === day;
        return (
          <li key={day} className={`kw-agenda__day${isSelected ? ' is-selected' : ''}`}>
            <button
              type="button"
              className="kw-agenda__date"
              onClick={() => onDayClick(day)}
              aria-label={`Open ${weekday} ${day}`}
            >
              <span className="kw-agenda__date-num">{day}</span>
              <span className="kw-agenda__date-dow">{weekday}</span>
            </button>
            <div className="kw-agenda__items">
              {list.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="kw-agenda__chip"
                  onClick={() => onDayClick(item.day)}
                  title={item.title}
                >
                  <span className={`kw-chip-status kw-chip-status--${item.status}`}>{item.statusLabel}</span>
                  <span className="kw-agenda__chip-title">{item.title}</span>
                  {item.format && item.kind === 'post' && (
                    <span className="kw-agenda__chip-format">{item.format}</span>
                  )}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default AgendaView;
