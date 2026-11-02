import type { Channel, StreamChat } from 'stream-chat';
import { getStoredToken } from '../utils/authSession';

/**
 * The browser side of support chat. Stream's client loads only when someone opens support,
 * signs in with a token from our server (the secret never reaches the browser), and is shared
 * by the Help panel and the Support dashboard.
 */
export interface StreamSession {
  client: StreamChat;
  apiKey: string;
  token: string;
  userId: string;
  name: string;
  role: string;
}

let session: Promise<StreamSession> | null = null;

/** Calls our support API with the signed-in session; throws with the server's message on failure. */
export async function supportApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`/api/support${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Support request failed (${res.status})`);
  return body as T;
}

export function streamSession(): Promise<StreamSession> {
  session ??= (async () => {
    const { apiKey, token, userId, name, role } = await supportApi<{ apiKey: string; token: string; userId: string; name: string; role: string }>('/stream-token');
    const { StreamChat } = await import('stream-chat');
    const client = StreamChat.getInstance(apiKey);
    if (client.userID !== userId) {
      if (client.userID) await client.disconnectUser();
      await client.connectUser({ id: userId, name }, token);
    }
    return { client, apiKey, token, userId, name, role };
  })().catch((error) => {
    session = null; // let the next open try again
    throw error;
  });
  return session;
}

/** The ticket's chat channel, watched so new messages, typing and read receipts arrive live. */
export async function ticketChannel(ticketId: string): Promise<Channel> {
  const [{ channelId }, { client }] = await Promise.all([
    supportApi<{ channelId: string }>(`/tickets/${encodeURIComponent(ticketId)}/channel`),
    streamSession(),
  ]);
  const channel = client.channel('messaging', channelId);
  await channel.watch({ messages: { limit: 100 } });
  return channel;
}

/** On sign-out, so the next person on this browser starts clean. */
export async function endStreamSession(): Promise<void> {
  const current = session;
  session = null;
  if (!current) return;
  try {
    const { client } = await current;
    await client.disconnectUser();
  } catch {
    /* already gone */
  }
}

/** Video call ids per ticket: one call room per conversation. */
export const callIdFor = (ticketId: string) => `kw-${ticketId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/** First reply targets per priority, in minutes (shown as "reply due in" and "overdue"). */
export const REPLY_TARGET_MIN: Record<string, number> = { Critical: 15, High: 60, Medium: 240, Low: 1440 };
