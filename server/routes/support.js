// Help desk tickets and live support calls.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { dbService, authenticateToken, requireStaff, validate, text, id, isStaff } from '../shared.js';
import { broadcastTicket, broadcastTicketCreated, broadcastCallsChanged } from '../realtime.js';
import { streamApiKey, tokenFor, ensureTicketChannel, addToChannel } from '../stream.js';

const router = Router();

const createTicketSchema = z.object({
  subject: text('A subject is required', 200),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).catch('Medium'),
  message: z.string().max(5000).default(''),
  category: z.enum(['Technical', 'Billing', 'General']).catch('General'),
});
const updateTicketSchema = z.object({
  status: z.enum(['Open', 'Pending', 'Resolved']).optional(),
  messages: z.array(z.looseObject({ sender: z.enum(['user', 'agent']), text: z.string().max(5000) })).max(500).optional(),
});
const resolveSchema = z.object({ userId: id });
const registerCallSchema = z.object({ roomName: text('A room name is required', 200), reason: z.string().max(500).optional() });
const unregisterCallSchema = z.object({ agentId: z.string().max(100).nullish(), userId: z.string().max(100).optional() });
const inboxSchema = z.object({
  status: z.enum(['Open', 'Pending', 'Resolved']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  assignee: z.enum(['me', 'none']).optional(),
  labels: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).optional(),
  snoozeHours: z.number().min(0).max(24 * 14).optional(),
});
const ratingSchema = z.object({ rating: z.number().int().min(1).max(5) });
const noteSchema = z.object({ body: text('Write a note first', 4000) });
const cannedSchema = z.object({
  id: z.string().max(100).optional(),
  shortcut: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/, 'Shortcut: 2–30 letters, numbers or dashes'),
  title: text('A title is required', 120),
  body: text('The reply text is required', 4000),
});

/** The name shown in chat: the business name for owners, the email name for staff. */
const displayName = async (userId, email) => {
  const u = await dbService.getUserById(userId);
  const fromEmail = (u?.email || email || '').split('@')[0];
  return u?.businessName || (fromEmail ? fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1) : 'Kawayan user');
};

const fail = (res, error, fallback) => {
  logger.error(fallback, { error: error.message });
  res.status(error.status === 503 ? 503 : 500).json({ error: error.status === 503 ? error.message : fallback });
};

/** Loads a ticket the caller may see: its owner, or any staff member. */
const ticketFor = async (req, res) => {
  const ticket = await dbService.getTicketById(req.params.id);
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return null; }
  if (ticket.userId !== req.user.userId && !isStaff(req.user)) { res.status(403).json({ error: 'Unauthorized' }); return null; }
  return ticket;
};

router.get('/api/support/tickets', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    res.json(isStaff(user) ? await dbService.getAllTicketsAdmin() : await dbService.getTickets(user.userId));
  } catch (error) {
    logger.error('Get tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.post('/api/support/tickets', authenticateToken, validate(createTicketSchema), async (req, res) => {
  const { subject, priority, message, category } = req.body;
  const user = req.user;

  try {
    const ticket = {
      id: Date.now().toString(),
      ticketNum: await dbService.getNextTicketNum(),
      userId: user.userId,
      userEmail: user.email,
      subject,
      category,
      priority,
      status: 'Open',
      createdAt: new Date().toISOString(),
      messages: [{ sender: 'user', text: message, timestamp: new Date().toISOString() }]
    };

    await dbService.createTicket(ticket);
    logger.logUserAction('create_ticket', user.userId, { ticketId: ticket.id });
    try {
      ticket.channelId = await ensureTicketChannel(ticket, await displayName(user.userId, user.email));
    } catch (error) {
      logger.warn('Ticket saved, but its chat channel could not be created yet', { ticketId: ticket.id, error: error.message });
    }
    broadcastTicketCreated(ticket);
    res.json(ticket);
  } catch (error) {
    logger.error('Create ticket error', { error: error.message });
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.put('/api/support/tickets/:id', authenticateToken, validate(updateTicketSchema), async (req, res) => {
  const { id } = req.params;
  const { status, messages } = req.body;
  const user = req.user;

  try {
    const existing = await dbService.getTicketById(id);
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.userId !== user.userId && !isStaff(user)) return res.status(403).json({ error: 'Unauthorized' });

    await dbService.updateTicket(id, status, messages);
    logger.logUserAction('update_ticket', user.userId, { ticketId: id, status });

    const ticket = await dbService.getTicketById(id);
    if (ticket) broadcastTicket(ticket);
    res.json(ticket || { message: 'Ticket updated' });
  } catch (error) {
    logger.error('Update ticket error', { error: error.message });
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// ── Stream: chat and calls ──

// A token for the signed-in person, so their browser can open support chat and calls.
router.get('/api/support/stream-token', authenticateToken, async (req, res) => {
  try {
    const name = await displayName(req.user.userId, req.user.email);
    const token = await tokenFor({ id: req.user.userId, name, role: req.user.role });
    res.json({ apiKey: streamApiKey(), token, userId: req.user.userId, name, role: req.user.role });
  } catch (error) {
    fail(res, error, 'Could not start support chat');
  }
});

// The ticket's chat channel (made on first open for tickets from before Stream).
router.get('/api/support/tickets/:id/channel', authenticateToken, async (req, res) => {
  try {
    const ticket = await ticketFor(req, res);
    if (!ticket) return;
    res.json({ channelId: await ensureTicketChannel(ticket, await displayName(ticket.userId, ticket.userEmail)) });
  } catch (error) {
    fail(res, error, 'Could not open this conversation');
  }
});

// ── Inbox actions (staff) ──

router.patch('/api/support/tickets/:id', authenticateToken, requireStaff, validate(inboxSchema), async (req, res) => {
  try {
    const ticket = await ticketFor(req, res);
    if (!ticket) return;
    const me = await displayName(req.user.userId, req.user.email);
    const { status, priority, assignee, labels, snoozeHours } = req.body;
    const fields = {};
    const history = [];
    if (status && status !== ticket.status) {
      fields.status = status;
      fields.resolvedAt = status === 'Resolved' ? new Date().toISOString() : null;
      if (status !== 'Resolved') fields.snoozedUntil = null;
      history.push(status === 'Resolved' ? 'resolved it' : `set the status to ${status}`);
    }
    if (priority && priority !== ticket.priority) { fields.priority = priority; history.push(`set priority to ${priority}`); }
    if (assignee === 'me' && ticket.assigneeId !== req.user.userId) {
      fields.assigneeId = req.user.userId; fields.assigneeName = me; history.push('assigned it to themselves');
      addToChannel(ticket.id, req.user.userId).catch((e) => logger.warn('Could not add agent to channel', { error: e.message }));
    }
    if (assignee === 'none' && ticket.assigneeId) { fields.assigneeId = null; fields.assigneeName = null; history.push('unassigned it'); }
    if (labels) { fields.labels = [...new Set(labels)]; history.push(labels.length ? `set labels to ${fields.labels.join(', ')}` : 'cleared the labels'); }
    if (snoozeHours !== undefined) {
      fields.snoozedUntil = snoozeHours ? new Date(Date.now() + snoozeHours * 3600_000).toISOString() : null;
      history.push(snoozeHours ? `snoozed it for ${snoozeHours < 24 ? `${snoozeHours} hour${snoozeHours === 1 ? '' : 's'}` : `${Math.round(snoozeHours / 24)} day${snoozeHours >= 48 ? 's' : ''}`}` : 'unsnoozed it');
    }
    if (!Object.keys(fields).length) return res.json(ticket);
    await dbService.updateTicketFields(ticket.id, fields);
    for (const line of history) await dbService.addTicketNote({ ticketId: ticket.id, authorId: req.user.userId, authorName: me, kind: 'activity', body: line });
    const fresh = await dbService.getTicketById(ticket.id);
    broadcastTicket(fresh);
    res.json(fresh);
  } catch (error) {
    fail(res, error, 'Could not update the ticket');
  }
});

// Someone replied in the chat. Staff: counts as the first reply (for reply targets) and waits on the owner.
// Owner: the ticket needs staff again.
router.post('/api/support/tickets/:id/replied', authenticateToken, async (req, res) => {
  try {
    const ticket = await ticketFor(req, res);
    if (!ticket) return;
    const fields = {};
    if (isStaff(req.user)) {
      if (!ticket.firstResponseAt) fields.firstResponseAt = new Date().toISOString();
      if (ticket.status === 'Open') fields.status = 'Pending';
    } else if (ticket.status !== 'Open') {
      fields.status = 'Open';
      fields.snoozedUntil = null;
      fields.resolvedAt = null;
    }
    if (Object.keys(fields).length) {
      await dbService.updateTicketFields(ticket.id, fields);
      const fresh = await dbService.getTicketById(ticket.id);
      broadcastTicket(fresh);
      return res.json(fresh);
    }
    res.json(ticket);
  } catch (error) {
    fail(res, error, 'Could not update the ticket');
  }
});

// The owner rates a resolved ticket, 1–5.
router.post('/api/support/tickets/:id/rating', authenticateToken, validate(ratingSchema), async (req, res) => {
  try {
    const ticket = await ticketFor(req, res);
    if (!ticket) return;
    if (ticket.userId !== req.user.userId) return res.status(403).json({ error: 'Only the person who asked can rate it' });
    if (ticket.status !== 'Resolved') return res.status(400).json({ error: 'You can rate a ticket once it’s resolved' });
    await dbService.updateTicketFields(ticket.id, { rating: req.body.rating });
    const fresh = await dbService.getTicketById(ticket.id);
    broadcastTicket(fresh);
    res.json(fresh);
  } catch (error) {
    fail(res, error, 'Could not save your rating');
  }
});

// Private notes and history (staff only).
router.get('/api/support/tickets/:id/notes', authenticateToken, requireStaff, async (req, res) => {
  try {
    res.json(await dbService.getTicketNotes(req.params.id));
  } catch (error) {
    fail(res, error, 'Could not load notes');
  }
});

router.post('/api/support/tickets/:id/notes', authenticateToken, requireStaff, validate(noteSchema), async (req, res) => {
  try {
    const ticket = await ticketFor(req, res);
    if (!ticket) return;
    const note = await dbService.addTicketNote({
      ticketId: ticket.id, authorId: req.user.userId, authorName: await displayName(req.user.userId, req.user.email), kind: 'note', body: req.body.body,
    });
    broadcastTicket(ticket);
    res.json(note);
  } catch (error) {
    fail(res, error, 'Could not save the note');
  }
});

// Saved replies (staff only).
router.get('/api/support/canned', authenticateToken, requireStaff, async (req, res) => {
  try {
    res.json(await dbService.getCannedReplies());
  } catch (error) {
    fail(res, error, 'Could not load saved replies');
  }
});

router.post('/api/support/canned', authenticateToken, requireStaff, validate(cannedSchema), async (req, res) => {
  try {
    await dbService.saveCannedReply({ ...req.body, createdBy: req.user.userId });
    res.json(await dbService.getCannedReplies());
  } catch (error) {
    if (/duplicate|unique/i.test(error.message)) return res.status(409).json({ error: `“/${req.body.shortcut}” is already used` });
    fail(res, error, 'Could not save the reply');
  }
});

router.delete('/api/support/canned/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    await dbService.deleteCannedReply(req.params.id);
    res.json(await dbService.getCannedReplies());
  } catch (error) {
    fail(res, error, 'Could not delete the reply');
  }
});

// Closes a user's open tickets when their support call ends (from either side of the call).
router.post('/api/support/tickets/resolve-user', authenticateToken, validate(resolveSchema), async (req, res) => {
  const { userId } = req.body;
  if (userId !== req.user.userId && !isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.resolveTicketByUserId(userId);
    const tickets = await dbService.getTickets(userId);
    tickets.filter((t) => t.status === 'Resolved').forEach(broadcastTicket);
    res.json({ message: 'User tickets resolved' });
  } catch (error) {
    logger.error('Resolve user tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to resolve tickets' });
  }
});

// Active calls
router.get('/api/support/calls', authenticateToken, requireStaff, async (req, res) => {
  try {
    res.json(await dbService.getActiveCalls());
  } catch (error) {
    logger.error('Get calls error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
});

router.get('/api/support/call-history', authenticateToken, requireStaff, async (req, res) => {
  try {
    res.json(await dbService.getCallHistory());
  } catch (error) {
    logger.error('Get call history error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

router.post('/api/support/calls/register', authenticateToken, validate(registerCallSchema), async (req, res) => {
  const { roomName, reason } = req.body;
  const user = req.user;
  try {
    await dbService.registerCall(user.userId, user.email, roomName, reason);
    broadcastCallsChanged();
    res.json({ message: 'Call registered' });
  } catch (error) {
    logger.error('Register call error', { error: error.message });
    res.status(500).json({ error: 'Failed to register call' });
  }
});

router.post('/api/support/calls/unregister', authenticateToken, validate(unregisterCallSchema), async (req, res) => {
  try {
    // Owners end their own call; staff can end the owner's call they were on.
    const ownerId = isStaff(req.user) && req.body.userId ? req.body.userId : req.user.userId;
    await dbService.unregisterCall(ownerId, req.body.agentId ?? (isStaff(req.user) ? req.user.userId : undefined));
    broadcastCallsChanged();
    res.json({ message: 'Call unregistered' });
  } catch (error) {
    logger.error('Unregister call error', { error: error.message });
    res.status(500).json({ error: 'Failed to unregister call' });
  }
});

export default router;
