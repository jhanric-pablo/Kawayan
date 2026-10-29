// Admin console: stats, audit logs, users, wallets, and business verifications.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { sendEmail } from '../../src/utils/mailer.ts';
import { dbService, authenticateToken, requireAdmin, validate, text, id } from '../shared.js';
import { broadcastVerificationChanged } from '../realtime.js';

const router = Router();
// Every route in this file is admin-only.
router.use('/api/admin', authenticateToken, requireAdmin);

const transactionSchema = z.object({ transactionId: id });
const updateUserSchema = z.object({
  role: z.enum(['user', 'admin', 'support']).optional(),
  businessName: z.string().trim().max(200).optional(),
});
const balanceSchema = z.object({
  userId: id,
  amount: z.number({ error: 'Enter an amount' }).refine((n) => n !== 0, 'Enter an amount other than 0'),
  reason: text('A reason is required', 300),
});
const subscriptionSchema = z.object({
  userId: id,
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
  expiresAt: z.string().max(50).nullish(),
});
const rejectSchema = z.object({ reason: z.string().trim().max(1000).optional() });

router.get('/api/admin/stats', async (req, res) => {
  const { start, end } = req.query;
  try {
    res.json(await dbService.getAdminStats(start, end));
  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/api/admin/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    res.json(await dbService.getAuditLogs(limit));
  } catch (error) {
    logger.error('Admin logs error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/api/admin/users', async (req, res) => {
  try {
    res.json(await dbService.getAllUsers());
  } catch (error) {
    logger.error('Admin users error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/api/admin/tickets', async (req, res) => {
  try {
    res.json(await dbService.getAllTicketsAdmin());
  } catch (error) {
    logger.error('Admin tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.put('/api/admin/users/:id', validate(updateUserSchema), async (req, res) => {
  try {
    await dbService.updateUser(req.params.id, req.body);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Admin update user error', { error: error.message });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch identities before deleting — audit_logs.user_id cascades on delete,
    // so the log is attributed to the admin, not the (about to be gone) account.
    const [deletedInfo, adminInfo] = await Promise.all([
      dbService.describeUser(id),
      dbService.describeUser(req.user.userId),
    ]);
    await dbService.deleteUser(id);
    await dbService.logAudit(req.user.userId, 'delete_user', `admin: ${adminInfo} deleted account: ${deletedInfo}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Admin delete user error', { error: error.message });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/api/admin/balance', validate(balanceSchema), async (req, res) => {
  const { userId, amount, reason } = req.body;
  try {
    await dbService.adminAdjustBalance(userId, amount, reason);
    res.json({ message: 'Balance adjusted successfully' });
  } catch (error) {
    logger.error('Admin balance error', { error: error.message });
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

router.post('/api/admin/subscription', validate(subscriptionSchema), async (req, res) => {
  const { userId, plan, expiresAt } = req.body;
  try {
    await dbService.adminUpdateSubscription(userId, plan, expiresAt);
    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    logger.error('Admin subscription error', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

router.post('/api/admin/wallet/approve', validate(transactionSchema), async (req, res) => {
  try {
    await dbService.approveTransaction(req.body.transactionId);
    res.json({ message: 'Transaction approved and balance updated' });
  } catch (error) {
    logger.error('Approval error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/pending-transactions', async (req, res) => {
  try {
    res.json(await dbService.getPendingTransactionsAdmin());
  } catch (error) {
    logger.error('Pending transactions error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// Business verifications
router.get('/api/admin/verifications', async (req, res) => {
  try {
    res.json(await dbService.getAllVerifications());
  } catch (error) {
    logger.error('Admin verifications list error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

router.post('/api/admin/verifications/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const verif = await dbService.getVerificationById(id);
    await dbService.approveVerification(id, req.user.userId);
    const [adminInfo, clientInfo, clientUser] = await Promise.all([
      dbService.describeUser(req.user.userId),
      verif?.userId ? dbService.describeUser(verif.userId) : Promise.resolve('unknown'),
      verif?.userId ? dbService.getUserById(verif.userId) : Promise.resolve(null),
    ]);
    await dbService.logAudit(req.user.userId, 'approve_verification', `admin: ${adminInfo} approved client: ${clientInfo}`);
    broadcastVerificationChanged(verif?.userId);
    if (clientUser?.email) {
      await sendEmail(
        clientUser.email,
        'Your Kawayan business verification is approved',
        `<p>Hi ${clientUser.businessName || 'there'},</p>
         <p>Your business verification for this Kawayan account has been approved.</p>
         <p><a href="https://kawayan-ai.onrender.com/">Sign in to your account</a></p>
         <p>Thanks for using Kawayan.</p>`
      );
    }
    res.json({ message: 'Verification approved' });
  } catch (error) {
    logger.error('Approve verification error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/verifications/:id/reject', validate(rejectSchema), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const verif = await dbService.getVerificationById(id);
    await dbService.rejectVerification(id, req.user.userId, reason || '');
    const [rejectorInfo, rejectedClientInfo] = await Promise.all([
      dbService.describeUser(req.user.userId),
      verif?.userId ? dbService.describeUser(verif.userId) : Promise.resolve('unknown'),
    ]);
    await dbService.logAudit(
      req.user.userId,
      'reject_verification',
      `admin: ${rejectorInfo} rejected client: ${rejectedClientInfo}${reason ? ` — reason: ${reason}` : ''}`
    );
    broadcastVerificationChanged(verif?.userId);
    res.json({ message: 'Verification rejected' });
  } catch (error) {
    logger.error('Reject verification error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// View a verification document (redirect to a short-lived signed Storage URL)
router.get('/api/admin/verifications/:id/document', async (req, res) => {
  try {
    const verif = await dbService.getVerificationById(req.params.id);
    if (!verif) return res.status(404).json({ error: 'Not found' });
    res.redirect(await dbService.getVerificationDocSignedUrl(verif.document_path));
  } catch (error) {
    logger.error('View document error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
