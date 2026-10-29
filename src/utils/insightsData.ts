import type { GeneratedPost } from '../types';

/*
 * Demo analytics for the Insights page.
 *
 * ponytail: every number here is generated, not fetched. Swap these functions for
 * Zernio's analytics endpoints once the plan includes them; the page only needs the
 * same Day / PostStats shapes back.
 *
 * Numbers are seeded by account, platform, post id and calendar date, so they stay
 * the same across reloads and range switches (a demo that reshuffles on refresh
 * looks fake).
 */

export type Platform = 'facebook' | 'instagram';
export type PlatformFilter = Platform | 'all';

export interface Day {
  date: string; // YYYY-MM-DD, local
  followers: number;
  reach: number;
  interactions: number;
  clicks: number;
}

export interface PostStats {
  id: string;
  date: string;
  topic: string;
  caption: string;
  imageUrl?: string;
  platform: Platform;
  viralityScore?: number;
  /** A built-in example, shown when the account has too few posts in the period to compare. */
  example?: boolean;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  interactions: number;
  engagementRate: number; // percent, 2 dp
}

export interface Kpi {
  key: 'followers' | 'reach' | 'interactions' | 'rate';
  label: string;
  current: number;
  previous: number;
  /** Fraction for counts (0.062 = +6.2%); percentage points for the engagement rate. */
  change: number;
  points?: boolean;
}

export const PLATFORM_NAMES: Record<Platform, string> = { facebook: 'Facebook', instagram: 'Instagram' };

/** FNV-1a hash feeding mulberry32: same seed, same sequence. */
export function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const addDays = (d: Date, n: number) => {
  const x = noon(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * One account's daily history on one platform, from a fixed start date to today.
 * The start is fixed (not "today minus N") so a given date always gets the same values.
 */
export function dailyHistory(userId: string, platform: Platform, today = new Date()): Day[] {
  const r = seeded(`${userId}:${platform}`);
  const base = platform === 'facebook' ? 900 + r() * 2600 : 600 + r() * 2200;
  const pace = base * (0.0012 + r() * 0.0016); // average new followers a day
  const reachShare = 0.25 + r() * 0.25; // typical share of followers reached a day
  const end = noon(today);
  const days: Day[] = [];
  let followers = base;
  // Six draws a day, always, so each date's values don't depend on branches taken earlier.
  for (const d = new Date(2025, 0, 1, 12); d <= end; d.setDate(d.getDate() + 1)) {
    followers += pace * r() * 2 - (r() < 0.08 ? pace * 1.5 : 0);
    const reach = followers * reachShare * (0.5 + r()) * (r() < 0.12 ? 2.4 : 1);
    days.push({
      date: isoDay(d),
      followers: Math.round(followers),
      reach: Math.round(reach),
      interactions: Math.round(reach * (0.02 + r() * 0.05)),
      clicks: Math.round(reach * (0.004 + r() * 0.012)),
    });
  }
  return days;
}

/** Facebook + Instagram, day by day (both histories cover the same dates). */
export const combineHistories = (a: Day[], b: Day[]): Day[] =>
  a.map((d, i) => ({
    date: d.date,
    followers: d.followers + b[i].followers,
    reach: d.reach + b[i].reach,
    interactions: d.interactions + b[i].interactions,
    clicks: d.clicks + b[i].clicks,
  }));

/** The last `days` days, and the `days` before them. */
export const periods = (history: Day[], days: number) => ({
  current: history.slice(-days),
  previous: history.slice(-2 * days, -days),
});

const total = (ds: Day[], k: 'reach' | 'interactions' | 'clicks') => ds.reduce((s, d) => s + d[k], 0);
const rateOf = (ds: Day[]) => {
  const reach = total(ds, 'reach');
  return reach ? (total(ds, 'interactions') / reach) * 100 : 0;
};
const growth = (current: number, previous: number) => (previous ? (current - previous) / previous : 0);

export function summarize(current: Day[], previous: Day[]): Kpi[] {
  const followersNow = current[current.length - 1].followers;
  const followersThen = previous[previous.length - 1].followers;
  const counts = (key: 'reach' | 'interactions', label: string): Kpi => {
    const c = total(current, key);
    const p = total(previous, key);
    return { key, label, current: c, previous: p, change: growth(c, p) };
  };
  const rateNow = rateOf(current);
  const rateThen = rateOf(previous);
  return [
    { key: 'followers', label: 'Followers', current: followersNow, previous: followersThen, change: growth(followersNow, followersThen) },
    counts('reach', 'Reach'),
    counts('interactions', 'Interactions'),
    { key: 'rate', label: 'Engagement rate', current: rateNow, previous: rateThen, change: rateNow - rateThen, points: true },
  ];
}

type PostInput = Pick<GeneratedPost, 'id' | 'date' | 'topic' | 'caption' | 'imageUrl' | 'viralityScore' | 'externalLink' | 'format'>;

export function postStats(post: PostInput, example = false, platform?: Platform): PostStats {
  const r = seeded(`post:${post.id}`);
  const coin = r();
  const link = post.externalLink || '';
  const where: Platform =
    platform ?? (link.includes('instagram.com') ? 'instagram' : link.includes('facebook.com') ? 'facebook' : coin < 0.5 ? 'facebook' : 'instagram');
  // The AI's virality score (0-100) nudges reach, so predicted and "actual" roughly agree.
  const score = post.viralityScore ?? 30 + r() * 50;
  const reach = Math.round((600 + r() * 3400) * (0.55 + score / 100) * (/reel|video/i.test(post.format || '') ? 1.35 : 1));
  const likes = Math.round(reach * (0.025 + r() * 0.05) * (0.7 + score / 200));
  const comments = Math.round(likes * (0.05 + r() * 0.15));
  const shares = Math.round(likes * (0.03 + r() * 0.12));
  const saves = Math.round(likes * (where === 'instagram' ? 0.08 + r() * 0.2 : 0.02 + r() * 0.06));
  const interactions = likes + comments + shares + saves;
  return {
    id: post.id,
    date: post.date,
    topic: post.topic,
    caption: post.caption,
    imageUrl: post.imageUrl,
    platform: where,
    viralityScore: post.viralityScore,
    example: example || undefined,
    reach,
    impressions: Math.round(reach * (1.15 + r() * 0.5)),
    likes,
    comments,
    shares,
    saves,
    clicks: Math.round(reach * (0.004 + r() * 0.018)),
    interactions,
    engagementRate: reach ? Math.round((interactions / reach) * 10000) / 100 : 0,
  };
}

const EXAMPLES = [
  { topic: 'Weekend promo', caption: 'Buy 1 Take 1 this Saturday lang! Tag the friend na isasama mo.' },
  { topic: 'Behind the scenes', caption: 'Ganito namin hinahanda ang orders every morning. Early call, full heart.' },
  { topic: 'Milestone giveaway', caption: 'Salamat sa 1,000 followers! Comment your favorite item for a chance to win.' },
  { topic: 'Customer story', caption: 'Meet Ate Joy, suki namin since day one. Salamat sa tiwala!' },
  { topic: 'Tips & how-tos', caption: 'Tip Tuesday: three easy ways to make your order last longer.' },
  { topic: 'New arrival', caption: 'Available na in store and online starting today. Sino excited?' },
];

/**
 * Posts dated inside the current period (any status, since the demo has no real
 * publish data). With fewer than 3 to compare, built-in examples fill the list.
 */
export function postsInPeriod(posts: PostInput[], userId: string, days: number, filter: PlatformFilter, today = new Date()): PostStats[] {
  const from = isoDay(addDays(today, -(days - 1)));
  const to = isoDay(today);
  const matches = (p: PostStats) => filter === 'all' || p.platform === filter;
  const real = posts.filter((p) => p.date >= from && p.date <= to).map((p) => postStats(p)).filter(matches);
  if (real.length >= 3) return real;
  const examples = EXAMPLES.map((e, k) =>
    postStats(
      { id: `example-${userId}-${k}`, date: isoDay(addDays(today, -Math.floor(((k + 0.5) * days) / EXAMPLES.length))), ...e },
      true,
      k % 2 ? 'instagram' : 'facebook',
    ),
  ).filter(matches);
  return [...real, ...examples];
}

export const COMPARE_METRICS: { key: keyof PostStats & string; label: string; percent?: boolean }[] = [
  { key: 'reach', label: 'Reach' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'likes', label: 'Reactions' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Link clicks' },
  { key: 'engagementRate', label: 'Engagement rate', percent: true },
];

/** Which post(s) lead each metric (ties share it), and the most effective post overall. */
export function comparePosts(posts: PostStats[]) {
  const best: Record<string, string[]> = {};
  for (const m of COMPARE_METRICS) {
    const top = Math.max(...posts.map((p) => p[m.key] as number));
    best[m.key] = posts.filter((p) => p[m.key] === top).map((p) => p.id);
  }
  const wins = (id: string) => COMPARE_METRICS.filter((m) => best[m.key].includes(id)).length;
  // Engagement rate decides effectiveness; reach breaks a tie.
  const winner = [...posts].sort((a, b) => b.engagementRate - a.engagementRate || b.reach - a.reach)[0];
  return { best, wins, winner };
}

// ── Downloads ──

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  // Keep spreadsheets from running a caption that starts with = + - @ as a formula.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with a BOM so Excel reads emoji and ñ correctly. */
export const toCsv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');

export const postsCsv = (posts: PostStats[]) =>
  toCsv([
    ['Date', 'Platform', 'Topic', 'Caption', 'Reach', 'Impressions', 'Reactions', 'Comments', 'Shares', 'Saves', 'Link clicks', 'Interactions', 'Engagement rate (%)', 'Example post'],
    ...posts.map((p) => [
      p.date, PLATFORM_NAMES[p.platform], p.topic, p.caption, p.reach, p.impressions, p.likes, p.comments,
      p.shares, p.saves, p.clicks, p.interactions, p.engagementRate.toFixed(2), p.example ? 'yes' : '',
    ]),
  ]);

export const growthCsv = (current: Day[], previous: Day[]) =>
  toCsv([
    ['Date', 'Followers', 'Reach', 'Interactions', 'Link clicks', 'Previous period date', 'Previous followers', 'Previous reach', 'Previous interactions', 'Previous link clicks'],
    ...current.map((d, i) => {
      const p = previous[i];
      return [d.date, d.followers, d.reach, d.interactions, d.clicks, p?.date, p?.followers, p?.reach, p?.interactions, p?.clicks];
    }),
  ]);
