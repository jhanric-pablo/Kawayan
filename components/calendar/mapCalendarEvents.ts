import type { ContentIdea, GeneratedPost } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import { PostChannels, clockTime, platformsFor } from '../../utils/workspaceFeed';

/**
 * Calendar data mapping for the Kawayan content planner.
 *
 * Used by the agenda (list) view and for the timeline's idea cards:
 *  - posts are shown for the visible month only
 *  - an idea is hidden once a post exists for that same day
 *  - idea days are clamped into the visible month
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
  /** An idea's position in the plan, for edits. */
  index?: number;
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
      index: idx,
    });
  });

  return items;
}

/* ── Channel timeline ── */

export type LaneId = 'plan' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
export type CardStatus = 'idea' | 'draft' | 'scheduled' | 'published' | 'failed';

export interface TimelineCardItem {
  key: string;
  day: number;
  status: CardStatus;
  title: string;
  format?: string;
  imageUrl?: string;
  /** Scheduled clock time, e.g. "9:00 AM", when known. */
  time?: string;
  post?: GeneratedPost;
  ideaIndex?: number;
}

/**
 * Sorts the visible month into timeline lanes, keyed `${lane}:${day}`. Drafts and ideas haven't
 * been sent anywhere, so they go in 'plan'; scheduled, published and failed posts go in each
 * channel they were sent to (or 'plan' when no channel is known).
 */
export function bucketByLane(
  posts: GeneratedPost[],
  ideas: ContentIdea[],
  month: Date,
  channels: PostChannels,
  accounts: SocialAccount[],
  failedIds: string[]
) {
  const cells = new Map<string, TimelineCardItem[]>();
  const laneCount = new Map<LaneId, number>();
  const add = (lane: LaneId, item: TimelineCardItem) => {
    const k = `${lane}:${item.day}`;
    cells.set(k, [...(cells.get(k) ?? []), item]);
    laneCount.set(lane, (laneCount.get(lane) ?? 0) + 1);
  };
  const prefix = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-`;
  posts.forEach((post) => {
    if (!post.date.startsWith(prefix)) return;
    const failed = post.status === 'Draft' && failedIds.includes(post.id);
    const status: CardStatus = failed ? 'failed' : post.status === 'Published' ? 'published' : post.status === 'Scheduled' ? 'scheduled' : 'draft';
    const sentTo: LaneId[] = status === 'draft' ? [] : platformsFor(post, channels, accounts);
    const item: TimelineCardItem = {
      key: post.id,
      day: Number(post.date.slice(8, 10)),
      status,
      title: post.topic,
      format: post.format,
      imageUrl: post.imageUrl,
      time: status === 'scheduled' ? clockTime(channels[post.id]?.at) : undefined,
      post,
    };
    (sentTo.length ? sentTo : (['plan'] as LaneId[])).forEach((lane) => add(lane, { ...item, key: `${post.id}:${lane}` }));
  });
  buildCalendarItems(posts, ideas, month).forEach((i) => {
    if (i.kind === 'idea') add('plan', { key: i.key, day: i.day, status: 'idea', title: i.title, format: i.format, ideaIndex: i.index });
  });
  return { cells, laneCount };
}
