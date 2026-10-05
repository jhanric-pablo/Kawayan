import { GeneratedPost } from '../types';

// Client for the server's /api/social/* routes, which proxy Zernio (docs.zernio.com).
export type SocialPlatform = 'facebook' | 'instagram';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName?: string;
  isActive: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('kawayan_jwt');
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) throw new Error("Posting to social media isn't switched on for this site yet.");
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const socialService = {
  listAccounts: () => request<SocialAccount[]>('/api/social/accounts'),

  // Sends the browser to the platform's login; it comes back to /?social=<platform>.
  async connect(platform: SocialPlatform) {
    const { authUrl } = await request<{ authUrl: string }>(`/api/social/connect/${platform}`);
    window.location.href = authUrl;
  },

  disconnect: (accountId: string) => request(`/api/social/accounts/${accountId}`, { method: 'DELETE' }),

  // Omit scheduledFor to publish immediately.
  publish: (postId: string, accountIds: string[], scheduledFor?: string) =>
    request<GeneratedPost>('/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({
        postId,
        accountIds,
        scheduledFor,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }),

  sync: () => request<{ published: number; failed: number }>('/api/social/sync', { method: 'POST' }),
};
