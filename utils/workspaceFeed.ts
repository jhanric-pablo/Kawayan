import type { GeneratedPost } from '../types';
import type { SocialAccount, SocialPlatform } from '../services/socialService';

/** Where a post was sent, recorded when it is published or scheduled from this browser. */
export type PostChannels = Record<string, { platforms: SocialPlatform[]; at?: string; queuedAt?: string }>;

export const failedPostsKey = (userId: string) => `kawayan_failed_posts_${userId}`;
export const postChannelsKey = (userId: string) => `kawayan_post_channels_${userId}`;

/** Fired when posts, failures or channel picks change, so the shell's feed refetches. */
export const FEED_EVENT = 'kawayan:feed-changed';

export const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ponytail: channel picks live in this browser (the posts table has no column for them). Posts
// sent from elsewhere fall back to every connected account, which is the composer's default pick.
export const platformsFor = (post: GeneratedPost, channels: PostChannels, accounts: SocialAccount[]): SocialPlatform[] =>
  channels[post.id]?.platforms ?? [...new Set(accounts.map((a) => a.platform))];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];

export function timeAgo(time: number): string {
  const s = (time - Date.now()) / 1000;
  for (const [unit, secs] of UNITS) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  return 'Just now';
}

/** "9:00 AM" from a local "YYYY-MM-DDTHH:mm:ss" schedule time. */
export const clockTime = (at?: string) =>
  at ? new Date(at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : undefined;

/** Posts, connected accounts and stored failures, as the app shell loads them. */
export interface WorkspaceFeed {
  posts: GeneratedPost[];
  accounts: SocialAccount[];
  /** 'error': the posting service couldn't be reached. */
  accountsState: 'loading' | 'ok' | 'error';
  failedIds: string[];
  channels: PostChannels;
  reload: () => void;
}
