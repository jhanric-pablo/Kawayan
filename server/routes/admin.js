// Admin console: stats, audit logs, users, wallets, and business verifications.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { sendEmail } from '../../src/utils/mailer.ts';
import { dbService, authenticateToken, requireAdmin, validate, text, id } from '../shared.js';
import { broadcastVerificationChanged } from '../realtime.js';
import { verifiedEmail } from '../verifiedEmail.js';

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
  amount: z.number({ error: 'Enter an amount' }).finite().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, 'Enter an amount other than 0'),
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

// System status for the admin overview. Only yes/no flags and timings: never key values.
router.get('/api/admin/system-status', async (req, res) => {
  const started = Date.now();
  let dbOk = false;
  try {
    const h = await dbService.healthCheck();
    dbOk = h?.status === 'healthy';
  } catch {
    dbOk = false;
  }
  const has = (...names) => names.every((n) => !!process.env[n]);
  res.json({
    api: { ok: true },
    database: { ok: dbOk, latencyMs: Date.now() - started },
    ai: { configured: has('AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY') || has('GROQ_API_KEY') || has('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN') },
    zernio: { configured: has('ZERNIO_API_KEY') },
    paymongo: { configured: has('PAYMONGO_SECRET_KEY'), testMode: String(process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_test_') },
    chat: { configured: has('STREAM_API_KEY', 'STREAM_API_SECRET') },
    checkedAt: new Date().toISOString(),
  });
});

router.get('/api/admin/logs', async (req, res) => {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 100));
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
  // An admin can't demote themselves (the console could end up with no admin).
  if (req.params.id === req.user.userId && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'You can’t change your own role.' });
  }
  try {
    await dbService.updateUser(req.params.id, req.body);
    const changes = [req.body.role && `role to ${req.body.role}`, req.body.businessName !== undefined && `business name to "${req.body.businessName}"`].filter(Boolean).join(', ');
    if (changes) await dbService.logAudit(req.user.userId, 'update_user', `admin: ${await dbService.describeUser(req.user.userId)} changed ${await dbService.describeUser(req.params.id)}: ${changes}`);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Admin update user error', { error: error.message });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.userId) return res.status(400).json({ error: 'You can’t delete your own account here.' });
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
    // Taking money out can't push the wallet below zero.
    if (amount < 0) {
      const balance = Number((await dbService.getWallet(userId))?.balance ?? 0);
      if (balance + amount < 0) return res.status(400).json({ error: `The wallet only has ₱${balance.toLocaleString('en-PH')}.` });
    }
    await dbService.adminAdjustBalance(userId, amount, reason);
    await dbService.logAudit(req.user.userId, 'adjust_balance', `admin: ${await dbService.describeUser(req.user.userId)} ${amount > 0 ? 'added' : 'removed'} ₱${Math.abs(amount).toLocaleString('en-PH')} ${amount > 0 ? 'to' : 'from'} ${await dbService.describeUser(userId)}: ${reason}`);
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
    await dbService.logAudit(req.user.userId, 'change_plan', `admin: ${await dbService.describeUser(req.user.userId)} set ${await dbService.describeUser(userId)} to ${plan}`);
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
      const mail = verifiedEmail({ businessName: clientUser.businessName, appUrl: process.env.APP_URL });
      await sendEmail(clientUser.email, mail.subject, mail.html, mail.text);
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
