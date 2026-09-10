import { ContentIdea, GeneratedPost } from '../../types';

/**
 * Calendar data mapping for the Kawayan content planner.
 *
 * The filtering rules here are a 1:1 port of the previous Schedule-X mapping:
 *  - posts are shown for the visible month only
 *  - an idea is hidden once a post exists for that same day
 *  - idea days are clamped into the visible month
 *
 * Only the output shape changed (TOAST UI Calendar event objects).
 */

export type KawayanStatus = 'idea' | 'draft' | 'scheduled' | 'published';

export interface KawayanCalendarItem {
  /** Stable key / event id */
  key: string;
  /** Day-of-month (1-31) — the unit every existing callback expects */
  day: number;
  /** ISO date, YYYY-MM-DD */
  date: string;
  title: string;
  status: KawayanStatus;
  statusLabel: 'Idea' | 'Draft' | 'Scheduled' | 'Published';
  format?: string;
  kind: 'post' | 'idea';
  postId?: string;
}

/** Shape TOAST UI Calendar accepts for `events` (subset we use). */
export interface KawayanEvent {
  id: string;
  calendarId: KawayanStatus;
  title: string;
  isAllday: true;
  category: 'allday';
  start: string;
  end: string;
  isReadOnly: true;
  raw: {
    day: number;
    kind: 'post' | 'idea';
    status: KawayanStatus;
    statusLabel: KawayanCalendarItem['statusLabel'];
    format?: string;
    postId?: string;
  };
}

const STATUS_LABEL: Record<KawayanStatus, KawayanCalendarItem['statusLabel']> = {
  idea: 'Idea',
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
};

const postStatus = (status: GeneratedPost['status']): KawayanStatus => {
  switch (status) {
    case 'Scheduled':
      return 'scheduled';
    case 'Published':
      return 'published';
    default:
      return 'draft';
  }
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Build the normalized item list for the visible month. */
export function buildCalendarItems(
  posts: GeneratedPost[],
  ideas: ContentIdea[],
  currentDate: Date
): KawayanCalendarItem[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const items: KawayanCalendarItem[] = [];

  posts.forEach((post) => {
    const [y, m, d] = post.date.split('-').map(Number);
    if (m - 1 !== month || y !== year) return;

    const status = postStatus(post.status);
    items.push({
      key: `post-${post.id}`,
      day: d,
      date: `${year}-${pad(month + 1)}-${pad(d)}`,
      title: post.topic,
      status,
      statusLabel: STATUS_LABEL[status],
      format: post.format || 'Image',
      kind: 'post',
      postId: post.id,
    });
  });

  ideas.forEach((idea, idx) => {
    const hasPost = posts.some((p) => {
      const [y, m, d] = p.date.split('-').map(Number);
      return d === idea.day && m - 1 === month && y === year;
    });
    if (hasPost) return;

    const safeDay = Math.min(Math.max(idea.day, 1), daysInMonth);
    items.push({
      key: `idea-${idea.day}-${idx}`,
      day: safeDay,
      date: `${year}-${pad(month + 1)}-${pad(safeDay)}`,
      title: idea.title,
      status: 'idea',
      statusLabel: 'Idea',
      format: idea.format,
      kind: 'idea',
    });
  });

  return items;
}

/** Convert normalized items into TOAST UI Calendar events (status → calendarId → colour). */
export function itemsToCalendarEvents(items: KawayanCalendarItem[]): KawayanEvent[] {
  return items.map((item) => ({
    id: item.key,
    calendarId: item.status,
    title: item.title,
    isAllday: true,
    category: 'allday',
    start: item.date,
    end: item.date,
    isReadOnly: true,
    raw: {
      day: item.day,
      kind: item.kind,
      status: item.status,
      statusLabel: item.statusLabel,
      format: item.format,
      postId: item.postId,
    },
  }));
}
