import type { CalendarEventExternal } from '@schedule-x/calendar';
import { ContentIdea, GeneratedPost } from '../../types';

/** Map existing posts + ideas into Schedule-X event objects (logic unchanged). */
export function mapToScheduleXEvents(
  posts: GeneratedPost[],
  ideas: ContentIdea[],
  currentDate: Date
): CalendarEventExternal[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const events: CalendarEventExternal[] = [];

  posts.forEach((post) => {
    const [y, m, d] = post.date.split('-').map(Number);
    if (m - 1 !== month || y !== year) return;

    const plain = Temporal.PlainDate.from({ year: y, month: m, day: d });
    events.push({
      id: `post-${post.id}`,
      title: post.topic,
      start: plain,
      end: plain,
      calendarId: 'post',
      kind: 'post',
      postId: post.id,
      status: post.status,
      format: post.format || 'Image',
      imageUrl: post.imageUrl,
      _options: {
        additionalClasses: ['kawayan-sx-event', 'kawayan-sx-event--post'],
        disableDND: true,
        disableResize: true,
      },
    });
  });

  ideas.forEach((idea, idx) => {
    const hasPost = posts.some((p) => {
      const [y, m, d] = p.date.split('-').map(Number);
      return d === idea.day && m - 1 === month && y === year;
    });
    if (hasPost) return;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(Math.max(idea.day, 1), daysInMonth);
    const plain = Temporal.PlainDate.from({ year, month: month + 1, day: safeDay });
    events.push({
      id: `idea-${idea.day}-${idx}`,
      title: idea.title,
      start: plain,
      end: plain,
      calendarId: 'idea',
      kind: 'idea',
      ideaDay: idea.day,
      format: idea.format,
      _options: {
        additionalClasses: ['kawayan-sx-event', 'kawayan-sx-event--idea'],
        disableDND: true,
        disableResize: true,
      },
    });
  });

  return events;
}

export function plainDateFromParts(year: number, monthIndex: number, day: number): Temporal.PlainDate {
  return Temporal.PlainDate.from({ year, month: monthIndex + 1, day });
}
