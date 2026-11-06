import { ContentIdea, GeneratedPost } from '../types';

export const TRIAL_POST_LIMIT = 8;
export const PRO_POST_LIMIT = 16;
/** Standalone single-post add-on (PHP). */
export const ADDON_POST_PRICE_PHP = 150;
/** Monthly Pro price (PHP); the server enforces the same value in PLAN_PRICES. */
export const PRO_PRICE_PHP = 499;

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export function getBatchLimitForSubscription(subscription: SubscriptionTier): number {
  return subscription === 'PRO' || subscription === 'ENTERPRISE' ? PRO_POST_LIMIT : TRIAL_POST_LIMIT;
}

/** Count saved posts for a calendar month (date format YYYY-MM-DD). */
export function countPostsInMonth(
  posts: GeneratedPost[],
  anchor: Date
): number {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  return posts.filter((p) => {
    const [y, m] = p.date.split('-').map(Number);
    return y === year && m - 1 === month;
  }).length;
}

export function isAtTierLimit(subscription: SubscriptionTier, monthlyPostCount: number): boolean {
  return monthlyPostCount >= getBatchLimitForSubscription(subscription);
}

export function remainingPostsForTier(
  subscription: SubscriptionTier,
  monthlyPostCount: number
): number {
  return Math.max(0, getBatchLimitForSubscription(subscription) - monthlyPostCount);
}

export const TIER_LIMIT_TITLE = 'Trial Limit Reached';

export interface ScheduleDayRange {
  minDay: number;
  maxDay: number;
}

/** Valid calendar days for scheduling within a viewed month (today → month end when viewing current month). */
export function getScheduleDayRange(calendarMonth: Date, now: Date = new Date()): ScheduleDayRange {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const isViewingCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const minDay = isViewingCurrentMonth ? now.getDate() : 1;
  return { minDay, maxDay };
}

// Video isn't offered yet: Kawayan makes captions and images only.
const FORMATS: ContentIdea['format'][] = ['Image', 'Text'];

/**
 * Place a plan's ideas on the calendar: one idea per open day, never two on the same day.
 * Open days are [minDay, maxDay] minus `taken` (days that already have a post). With more ideas
 * than open days the extras are left out; with fewer ideas than `targetCount` the plan is padded
 * with variations. An idea keeps its own day when that day is open; the rest spread evenly.
 */
export function normalizeIdeasToBatchCount(
  ideas: ContentIdea[],
  targetCount: number,
  range?: ScheduleDayRange,
  taken: Set<number> = new Set()
): ContentIdea[] {
  const minDay = range?.minDay ?? 1;
  const maxDay = range?.maxDay ?? 28;
  const open: number[] = [];
  for (let d = minDay; d <= maxDay; d++) if (!taken.has(d)) open.push(d);
  const count = Math.min(targetCount, open.length);
  if (count <= 0) return [];

  const source = ideas.length ? ideas : buildDefaultIdeas(count, minDay, maxDay);
  const picked = Array.from({ length: count }, (_, i) => {
    const idea = source[i % source.length];
    return i < source.length ? { ...idea } : { ...idea, topic: `${idea.topic} · Batch angle ${i + 1}` };
  });

  const used = new Set<number>();
  const unplaced: ContentIdea[] = [];
  const result: ContentIdea[] = [];
  picked.forEach((idea) => {
    if (open.includes(idea.day) && !used.has(idea.day)) {
      used.add(idea.day);
      result.push(idea);
    } else unplaced.push(idea);
  });
  const free = open.filter((d) => !used.has(d));
  unplaced.forEach((idea, j) => {
    // Evenly spaced picks are distinct because there are at least as many free days as ideas left.
    const at = unplaced.length === 1 ? 0 : Math.round((j * (free.length - 1)) / (unplaced.length - 1));
    result.push({ ...idea, day: free[at], format: idea.format || FORMATS[j % FORMATS.length] });
  });
  return result.sort((a, b) => a.day - b.day);
}

function buildDefaultIdeas(count: number, minDay: number, maxDay: number): ContentIdea[] {
  const daySpan = maxDay - minDay + 1;
  const slotCount = Math.min(count, daySpan);
  return Array.from({ length: count }, (_, i) => {
    const slotIndex = i % slotCount;
    let day: number;
    if (slotCount === 1) {
      day = minDay;
    } else {
      day = minDay + Math.round((slotIndex / (slotCount - 1)) * (maxDay - minDay));
    }
    return {
      day: Math.min(maxDay, Math.max(minDay, day)),
      title: `Content Slot ${i + 1}`,
      topic: `Monthly content theme ${i + 1}`,
      format: FORMATS[i % FORMATS.length],
    };
  });
}

export const TIER_LIMIT_MESSAGE =
  "You've reached your Free Trial limit of 8 posts for this month. Upgrade to Pro for 16 posts per month, deeper analytics, and unlimited creative batching.";
