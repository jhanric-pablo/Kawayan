import React from 'react';
import { CalendarClock, CircleAlert, PencilLine, Sun } from 'lucide-react';
import { GeneratedPost } from '../../types';
import './kawayanCalendar.css';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const short = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
const clip = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * What needs the owner today: posts that failed to go out, today's posts, drafts due this
 * week, and the next scheduled post. Each item opens that post in the studio.
 */
const UpNext: React.FC<{ posts: GeneratedPost[]; failedIds: string[]; onOpen: (post: GeneratedPost) => void; onPlan: () => void }> = ({
  posts,
  failedIds,
  onOpen,
  onPlan,
}) => {
  if (posts.length === 0) return null;
  const now = new Date();
  const today = iso(now);
  const weekEnd = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const byDate = (a: GeneratedPost, b: GeneratedPost) => a.date.localeCompare(b.date);

  const failed = posts.filter((p) => failedIds.includes(p.id) && p.status === 'Draft').sort(byDate);
  const todays = posts.filter((p) => p.date === today && !failedIds.includes(p.id));
  const drafts = posts.filter((p) => p.status === 'Draft' && p.date > today && p.date <= weekEnd && !failedIds.includes(p.id)).sort(byDate);
  const next = posts.filter((p) => p.status === 'Scheduled' && p.date > today).sort(byDate)[0];

  const empty = !failed.length && !todays.length && !drafts.length && !next;

  return (
    <section className="un" aria-label="Up next">
      <span className="un__label">Up next</span>
      <div className="un__items">
        {failed.map((p) => (
          <button key={p.id} type="button" className="un__item is-failed" onClick={() => onOpen(p)}>
            <CircleAlert aria-hidden />
            <span><b>Didn’t go out</b> {clip(p.topic)} · {short(p.date)}</span>
            <em>Reschedule</em>
          </button>
        ))}
        {todays.map((p) => (
          <button key={p.id} type="button" className="un__item is-today" onClick={() => onOpen(p)}>
            <Sun aria-hidden />
            <span><b>Today</b> {clip(p.topic)} · {p.status === 'Draft' ? 'still a draft' : p.status.toLowerCase()}</span>
            {p.status === 'Draft' && <em>Review</em>}
          </button>
        ))}
        {drafts.length > 0 && (
          <button type="button" className="un__item" onClick={() => onOpen(drafts[0])}>
            <PencilLine aria-hidden />
            <span><b>{drafts.length} draft{drafts.length === 1 ? '' : 's'}</b> to review this week · next {short(drafts[0].date)}</span>
            <em>Review</em>
          </button>
        )}
        {next && (
          <button type="button" className="un__item" onClick={() => onOpen(next)}>
            <CalendarClock aria-hidden />
            <span><b>Next post</b> {short(next.date)} · {clip(next.topic, 28)}</span>
          </button>
        )}
        {empty && (
          <button type="button" className="un__item" onClick={onPlan}>
            <CalendarClock aria-hidden />
            <span><b>Nothing due this week.</b> Plan ahead</span>
            <em>Plan month</em>
          </button>
        )}
      </div>
    </section>
  );
};

export default UpNext;
