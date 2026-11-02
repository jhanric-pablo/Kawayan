// Stream (getstream.io) runs support chat and calls. The server holds the secret: it signs each
// person's Stream token and sets up one chat channel per ticket. The browser never sees the secret.
import { StreamChat } from 'stream-chat';
import { logger } from '../src/utils/logger.ts';

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

export const streamReady = () => !!(apiKey && apiSecret);
export const streamApiKey = () => apiKey;

let client = null;
const server = () => {
  if (!streamReady()) throw Object.assign(new Error('Support chat is not set up yet (STREAM_API_KEY / STREAM_API_SECRET missing).'), { status: 503 });
  client ??= StreamChat.getInstance(apiKey, apiSecret);
  return client;
};

const isStaffRole = (role) => role === 'admin' || role === 'support';

/** Ticket channel id; Stream allows letters, numbers, "-" and "_". */
export const ticketChannelId = (ticketId) => `ticket-${String(ticketId).replace(/[^a-zA-Z0-9_-]/g, '')}`;

/**
 * Makes sure this person exists in Stream and returns a token for them.
 * Staff get Stream's "admin" role so they can open every ticket's channel; owners are plain users.
 */
export async function tokenFor(user) {
  const c = server();
  await c.upsertUser({
    id: user.id,
    name: user.name,
    role: isStaffRole(user.role) ? 'admin' : 'user',
    kawayan_role: user.role,
  });
  return c.createToken(user.id);
}

/**
 * The ticket's chat channel, created on first use. Older tickets kept their messages in the
 * database; those are copied in (oldest first) the first time the channel is made.
 */
export async function ensureTicketChannel(ticket, ownerName) {
  const c = server();
  await c.upsertUser({ id: ticket.userId, name: ownerName || ticket.userEmail, role: 'user', kawayan_role: 'user' });
  const channel = c.channel('messaging', ticketChannelId(ticket.id), {
    created_by_id: ticket.userId,
    members: [ticket.userId],
    name: ticket.subject,
    ticket_id: ticket.id,
    ticket_num: ticket.ticketNum,
  });
  await channel.create();
  // create() on an existing channel doesn't return its messages, so ask for one to know if it's new.
  const { messages = [] } = await channel.query({ messages: { limit: 1 }, watch: false, state: true });
  const fresh = !messages.length;
  if (fresh && Array.isArray(ticket.messages) && ticket.messages.length) {
    const agentId = 'kawayan-support';
    await c.upsertUser({ id: agentId, name: 'Kawayan support', role: 'admin', kawayan_role: 'support' });
    for (const m of ticket.messages) {
      if (!m?.text) continue;
      try {
        await channel.sendMessage({ text: m.text, user_id: m.sender === 'agent' ? agentId : ticket.userId, sent_at: m.timestamp, silent: true });
      } catch (error) {
        logger.warn('Could not copy an old ticket message to Stream', { ticketId: ticket.id, error: error.message });
      }
    }
  }
  return channel.id;
}

/** Adds a staff member to the ticket's channel so they show as a participant (they can already read it). */
export async function addToChannel(ticketId, userId) {
  const channel = server().channel('messaging', ticketChannelId(ticketId));
  await channel.addMembers([userId]);
}
