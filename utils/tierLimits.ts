import { ContentIdea, GeneratedPost } from '../types';

export const TRIAL_POST_LIMIT = 8;
export const PRO_POST_LIMIT = 16;

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

const FORMATS: ContentIdea['format'][] = ['Image', 'Carousel', 'Video', 'Text'];

/**
 * Pad or trim ideas so batch generation always targets exactly `targetCount` slots.
 * AI plans often return 5–7 items; trial requires 8 and pro requires 16.
 * When `range` is set, days are clamped to [minDay, maxDay] (e.g. today onward).
 */
export function normalizeIdeasToBatchCount(
  ideas: ContentIdea[],
  targetCount: number,
  range?: ScheduleDayRange
): ContentIdea[] {
  const minDay = range?.minDay ?? 1;
  const maxDay = range?.maxDay ?? 28;
  const daySpan = maxDay - minDay + 1;

  if (targetCount <= 0 || daySpan <= 0) return [];
  if (!ideas.length) {
    return buildDefaultIdeas(targetCount, minDay, maxDay);
  }

  const usedDays = new Set<number>();
  const result: ContentIdea[] = [];

  const assignDay = (index: number): number => {
    const slotCount = Math.min(targetCount, daySpan);
    const slotIndex = index % slotCount;
    let day: number;
    if (slotCount === 1) {
      day = minDay;
    } else {
      day = minDay + Math.round((slotIndex / (slotCount - 1)) * (maxDay - minDay));
    }
    day = Math.min(maxDay, Math.max(minDay, day));
    while (usedDays.has(day) && day < maxDay) day += 1;
    if (usedDays.has(day)) {
      day = minDay;
      while (usedDays.has(day) && day <= maxDay) day += 1;
    }
    if (day > maxDay) {
      day = minDay + (index % daySpan);
      while (usedDays.has(day) && day <= maxDay) day += 1;
    }
    usedDays.add(day);
    return day;
  };

  const isValidDay = (day: number) => day >= minDay && day <= maxDay;

  for (let i = 0; i < targetCount; i++) {
    const source = ideas[i % ideas.length];
    if (i < ideas.length && isValidDay(ideas[i].day) && !usedDays.has(ideas[i].day)) {
      usedDays.add(ideas[i].day);
      result.push({ ...ideas[i] });
      continue;
    }

    result.push({
      day: assignDay(i),
      title: source.title,
      topic:
        i < ideas.length
          ? source.topic
          : `${source.topic} · Batch angle ${i + 1}`,
      format: source.format || FORMATS[i % FORMATS.length],
    });
  }

  return result;
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
