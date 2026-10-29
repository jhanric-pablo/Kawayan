// Wallet & Payments — everything is paid through PayMongo Checkout (docs.paymongo.com).
// Wallet top-ups are pending CREDIT transactions; Pro is a pending DEBIT paid straight by
// card/GCash/Maya, so it never touches the balance (the wallet is for extra posts only).
// Either way the checkout session id rides in the description, and nothing changes until
// PayMongo reports that session as paid.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { ADDON_POST_PRICE_PHP, PRO_PRICE_PHP } from '../../src/utils/tierLimits.ts';
import { dbService, authenticateToken, validate, id, isStaff, isSelfOrAdmin, sendUpstreamError, originOf } from '../shared.js';

const router = Router();

const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PLAN_PRICES = { PRO: PRO_PRICE_PHP };
const TOPUP_MIN = 100;
const TOPUP_MAX = 50000;
const checkoutSessionIdOf = (description = '') => /\((cs_[A-Za-z0-9]+)\)/.exec(description)?.[1];
const planTitle = (plan) => plan.charAt(0) + plan.slice(1).toLowerCase();
// "Pro plan (monthly) via PayMongo (cs_…)" → 'PRO'; top-ups → undefined.
const planOf = (txn) =>
  txn?.type === 'DEBIT' ? Object.keys(PLAN_PRICES).find((p) => txn.description?.startsWith(`${planTitle(p)} plan`)) : undefined;

const topUpMessage = `Enter a whole amount from ₱${TOPUP_MIN} to ₱${TOPUP_MAX.toLocaleString()}.`;
const checkoutSchema = z.object({
  amount: z.coerce.number({ error: topUpMessage }).int(topUpMessage).min(TOPUP_MIN, topUpMessage).max(TOPUP_MAX, topUpMessage),
});
const planCheckoutSchema = z.object({ plan: z.enum(Object.keys(PLAN_PRICES), 'Unknown plan') });
const transactionSchema = z.object({ transactionId: id });
// The price of an extra post is fixed here; whatever amount the browser sends is ignored.
const purchaseSchema = z.object({ userId: id, description: z.string().trim().max(300).default('') });
const userSchema = z.object({ userId: id });

async function paymongo(path, { method = 'GET', body } = {}) {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw Object.assign(new Error('Payments are not set up yet (PAYMONGO_SECRET_KEY is missing).'), { status: 503 });
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64'),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never pass PayMongo's 401 through: the client treats that as an expired Kawayan session.
    const detail = data.errors?.[0]?.detail || `PayMongo request failed (${res.status})`;
    throw Object.assign(new Error(detail), { status: res.status === 400 ? 400 : 502 });
  }
  return data;
}

const createCheckout = async (req, { name, amount, description, reference }) => {
  const origin = originOf(req);
  const { data: session } = await paymongo('/checkout_sessions', {
    method: 'POST',
    body: {
      data: {
        attributes: {
          line_items: [{ name, amount: amount * 100, currency: 'PHP', quantity: 1 }],
          payment_method_types: ['gcash', 'paymaya', 'card'],
          description,
          reference_number: reference,
          success_url: `${origin}/?success=true`,
          cancel_url: `${origin}/?cancelled=true`,
        },
      },
    },
  });
  return session;
};

// Settles the user's pending PayMongo payment once PayMongo says it's paid: a top-up
// credits the wallet, a plan payment switches the plan.
async function settlePendingPayment(userId) {
  const pending = await dbService.getPendingTransaction(userId);
  const sessionId = checkoutSessionIdOf(pending?.description);
  if (!sessionId) return { status: 'NONE', pending };
  const plan = planOf(pending);
  const { data: session } = await paymongo(`/checkout_sessions/${sessionId}`);
  if (session.attributes.payments?.some((p) => p.attributes?.status === 'paid')) {
    try {
      await dbService.approveTransaction(pending.id, !plan);
      const who = await dbService.describeUser(userId);
      if (plan) {
        await dbService.updateSubscription(userId, plan);
        await dbService.logAudit(userId, 'upgrade_plan', `${who} upgraded to ${plan} for ₱${pending.amount} via PayMongo (${sessionId})`);
      } else {
        await dbService.logAudit(userId, 'wallet_topup', `${who} added ₱${pending.amount} via PayMongo (${sessionId})`);
      }
    } catch (error) {
      if (!/not found/i.test(error.message)) throw error; // a parallel request already settled it
    }
    return { status: 'COMPLETED', amount: pending.amount, plan };
  }
  if (session.attributes.status === 'expired') {
    await dbService.failTransaction(pending.id);
    return { status: 'FAILED' };
  }
  return { status: 'PENDING', pending, plan, sessionId, checkoutUrl: session.attributes.checkout_url };
}

router.get('/api/wallet/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (!isSelfOrAdmin(req.user, userId) && !isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const wallet = await dbService.getWallet(userId);
    res.json({ ...wallet, paymentsTestMode: (process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_test_') });
  } catch (error) {
    logger.error('Get wallet error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Start a PayMongo hosted checkout for a wallet top-up.
router.post('/api/wallet/checkout', authenticateToken, validate(checkoutSchema), async (req, res) => {
  const { userId, email } = req.user;
  const { amount } = req.body;
  try {
    await dbService.getWallet(userId); // expires pending top-ups older than 12h
    if (await dbService.getPendingTransaction(userId)) {
      return res.status(409).json({ error: 'You already have a payment in progress. Finish or cancel it first.' });
    }
    const session = await createCheckout(req, {
      name: 'Kawayan wallet top-up',
      amount,
      description: `Wallet top-up for ${email}`,
      reference: `${userId}-${Date.now()}`,
    });
    await dbService.createTransaction(userId, amount, `Wallet top-up via PayMongo (${session.id})`, 'CREDIT', 'PENDING');
    res.json({ checkoutUrl: session.attributes.checkout_url });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to start checkout');
  }
});

// Pro goes straight to a PayMongo checkout for its price; nothing is taken from the wallet.
router.post('/api/wallet/checkout-plan', authenticateToken, validate(planCheckoutSchema), async (req, res) => {
  const { userId, email } = req.user;
  const { plan } = req.body;
  const price = PLAN_PRICES[plan];
  try {
    const wallet = await dbService.getWallet(userId); // also expires pending payments older than 12h
    if (wallet.subscription === plan) return res.status(409).json({ error: `You're already on ${planTitle(plan)}.` });
    if (await dbService.getPendingTransaction(userId)) {
      return res.status(409).json({ error: 'You already have a payment in progress. Finish or cancel it first.' });
    }
    const session = await createCheckout(req, {
      name: `Kawayan ${planTitle(plan)} (1 month)`,
      amount: price,
      description: `Kawayan ${planTitle(plan)} for ${email}`,
      reference: `${userId}-${plan}-${Date.now()}`,
    });
    await dbService.createTransaction(userId, price, `${planTitle(plan)} plan (monthly) via PayMongo (${session.id})`, 'DEBIT', 'PENDING');
    res.json({ checkoutUrl: session.attributes.checkout_url });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to start checkout');
  }
});

// Called when the user returns from PayMongo (and on Billing load) to settle a paid payment.
router.post('/api/wallet/verify', authenticateToken, async (req, res) => {
  try {
    const { status, amount, plan, checkoutUrl } = await settlePendingPayment(req.user.userId);
    res.json({ status, amount, plan, checkoutUrl });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to check payment');
  }
});

router.post('/api/wallet/cancel-transaction', authenticateToken, validate(transactionSchema), async (req, res) => {
  const { transactionId } = req.body;
  const { userId } = req.user;

  try {
    // If PayMongo isn't configured we can't check the session; still let the user clear it locally.
    const result = await settlePendingPayment(userId).catch((error) => {
      if (error.status === 503) return { status: 'UNCHECKED' };
      throw error;
    });
    if (result.status === 'COMPLETED') {
      const outcome = result.plan ? `You're on ${planTitle(result.plan)} now.` : `₱${result.amount} was added to your wallet.`;
      return res.status(409).json({ error: `That payment already went through. ${outcome}` });
    }
    if (result.status === 'PENDING' && result.pending.id === transactionId) {
      // Close the PayMongo page too, so it can't be paid after we've cancelled it here.
      await paymongo(`/checkout_sessions/${result.sessionId}/expire`, { method: 'POST' }).catch(() => undefined);
    }
    await dbService.cancelTransaction(transactionId, userId);
    res.json(await dbService.getWallet(userId));
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to cancel payment');
  }
});

// Wallet spending: one extra post per purchase. Plans are paid through /api/wallet/checkout-plan.
router.post('/api/wallet/purchase', authenticateToken, validate(purchaseSchema), async (req, res) => {
  const { userId, description } = req.body;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });

  const price = ADDON_POST_PRICE_PHP;
  // savePost counts "Extra post:" debits to decide how many add-on posts the user has paid for.
  const topic = description.replace(/^Extra post:\s*/i, '');

  try {
    const wallet = await dbService.getWallet(userId);
    if (wallet.balance < price) {
      return res.status(400).json({ error: `Not enough balance. You need ₱${price}, you have ₱${wallet.balance}.` });
    }

    await dbService.createTransaction(userId, price, `Extra post: ${topic}`, 'DEBIT');
    res.json(await dbService.getWallet(userId));
  } catch (error) {
    logger.error('Purchase error', { error: error.message });
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

router.post('/api/wallet/cancel', authenticateToken, validate(userSchema), async (req, res) => {
  const { userId } = req.body;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.updateSubscription(userId, 'FREE');
    res.json(await dbService.getWallet(userId));
  } catch (error) {
    logger.error('Cancel subscription error', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
