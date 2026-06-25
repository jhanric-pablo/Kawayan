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

const FORMATS: ContentIdea['format'][] = ['Image', 'Carousel', 'Video', 'Text'];

/**
 * Pad or trim ideas so batch generation always targets exactly `targetCount` slots.
 * AI plans often return 5–7 items; trial requires 8 and pro requires 16.
 */
export function normalizeIdeasToBatchCount(
  ideas: ContentIdea[],
  targetCount: number
): ContentIdea[] {
  if (targetCount <= 0) return [];
  if (!ideas.length) {
    return buildDefaultIdeas(targetCount);
  }

  const usedDays = new Set<number>();
  const result: ContentIdea[] = [];

  const assignDay = (index: number): number => {
    const spread = Math.min(
      28,
      Math.max(1, Math.round(((index + 1) / (targetCount + 1)) * 28))
    );
    let day = spread;
    while (usedDays.has(day) && day < 28) day += 1;
    if (usedDays.has(day)) day = index + 1;
    while (usedDays.has(day) && day <= 31) day += 1;
    usedDays.add(day);
    return day;
  };

  for (let i = 0; i < targetCount; i++) {
    const source = ideas[i % ideas.length];
    if (i < ideas.length && !usedDays.has(ideas[i].day)) {
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

function buildDefaultIdeas(count: number): ContentIdea[] {
  return Array.from({ length: count }, (_, i) => ({
    day: Math.min(28, Math.max(1, Math.round(((i + 1) / (count + 1)) * 28))),
    title: `Content Slot ${i + 1}`,
    topic: `Monthly content theme ${i + 1}`,
    format: FORMATS[i % FORMATS.length],
  }));
}

export const TIER_LIMIT_MESSAGE =
  "You've reached your Free Trial limit of 8 posts for this month. Upgrade to Pro for 16 posts per month, deeper analytics, and unlimited creative batching.";

export const TIER_LIMIT_TITLE = 'Trial Limit Reached';
