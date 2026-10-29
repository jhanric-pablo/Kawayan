// Help desk tickets and live support calls.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { dbService, authenticateToken, requireStaff, validate, text, id, isStaff } from '../shared.js';
import { broadcastTicket, broadcastTicketCreated, broadcastCallsChanged } from '../realtime.js';

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
const unregisterCallSchema = z.object({ agentId: z.string().max(100).nullish() });

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
    await dbService.unregisterCall(req.user.userId, req.body.agentId ?? undefined);
    broadcastCallsChanged();
    res.json({ message: 'Call unregistered' });
  } catch (error) {
    logger.error('Unregister call error', { error: error.message });
    res.status(500).json({ error: 'Failed to unregister call' });
  }
});

export default router;
