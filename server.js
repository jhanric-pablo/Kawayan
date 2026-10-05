import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { SupabaseService } from './services/supabaseService.ts';
import { JWTService } from './services/jwtService.ts';
import { logger } from './utils/logger.ts';
import { sendEmail } from './utils/mailer.ts';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 3001;

// Signaling Logic
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.data.roomId = roomId; // Track room for disconnect
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('signal', (data) => {
    // data contains: { to: socketId, from: socketId, signal: sdp/ice }
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  socket.on('message', (data) => {
    // data: { roomId, text, sender }
    io.to(data.roomId).emit('message', {
      text: data.text,
      sender: data.sender,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('cam-state', (data) => {
    socket.to(data.roomId).emit('cam-state', data.active);
  });

  socket.on('screen-state', (data) => {
    socket.to(data.roomId).emit('screen-state', data.active);
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-left');
    }
  });

  // Support hub — tickets & calls (real-time, no refresh)
  socket.on('support:join', ({ token }) => {
    if (!token) return;
    const payload = JWTService.verifyToken(token);
    if (!payload) return;

    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    socket.join(`user-${payload.userId}`);

    if (payload.role === 'support' || payload.role === 'admin') {
      socket.join('support-staff');
    }
  });
});

/** Push ticket updates to support staff and the ticket owner instantly */
const broadcastTicket = async (ticketId) => {
  const ticket = await dbService.getTicketById(ticketId);
  if (!ticket) return;
  io.to('support-staff').emit('ticket:updated', ticket);
  io.to(`user-${ticket.userId}`).emit('ticket:updated', ticket);
};

const broadcastTicketCreated = (ticket) => {
  io.to('support-staff').emit('ticket:created', ticket);
  io.to(`user-${ticket.userId}`).emit('ticket:updated', ticket);
};

const broadcastCallsChanged = () => {
  io.to('support-staff').emit('calls:changed');
};

const broadcastVerificationChanged = (userId) => {
  io.to('support-staff').emit('verification:updated');
  if (userId) io.to(`user-${userId}`).emit('verification:updated');
};

// Trust proxy (required for Codespaces/Heroku/etc to get correct protocol/host)
app.set('trust proxy', true);

// Middleware
app.use(cors());
// Default 100kb is too small for posts carrying a Cloudflare-generated image
// (returned as a base64 data URL, ~700KB-1MB, stored directly on the post).
app.use(express.json({ limit: '10mb' }));

// CSP Middleware to allow Social Plugins
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://* *.tiktok.com *.facebook.com *.google.com *.googleapis.com *.googletagmanager.com; " +
    "style-src 'self' 'unsafe-inline' https://* *.googleapis.com; " +
    "img-src 'self' data: https://* *.facebook.com *.googleusercontent.com *.tiktokcdn.com; " +
    "font-src 'self' data: https://* *.gstatic.com; " +
    "connect-src 'self' https://* *.tiktokapis.com *.facebook.com *.google-analytics.com;" +
    "frame-src 'self' https://* *.tiktok.com *.facebook.com;"
  );
  next();
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize Database Service
const dbService = new SupabaseService();

// ── Process-level safety net ─────────────────────────────────────────
// A thrown error in an un-awaited promise used to take the whole server
// down (→ ECONNREFUSED for the client). Log and keep serving instead.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception (server kept alive)', { error: err?.message, stack: err?.stack });
});

// Wrap async route handlers so a rejected promise becomes a clean 500
// instead of an unhandled rejection.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  const payload = JWTService.verifyToken(token);
  if (!payload) return res.sendStatus(403);

  req.user = payload;
  next();
};

const requireAdmin = (req, res, next) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- Multer File Upload (Business Verification Documents) ---
// Buffered in memory, then handed to SupabaseService to upload into the
// private 'verifications' Storage bucket — no local disk involved.
const uploadVerifDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    // Multer/busboy decodes multipart filenames as latin1; re-decode as utf8 so
    // non-ASCII names (accents, macOS's narrow no-break space in "7.50.03 AM") render correctly.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or PDF files are accepted'));
  }
});

// --- Routes ---

// Health Check
app.get('/api/health', async (req, res) => {
  const status = await dbService.healthCheck();
  res.json(status);
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, businessName, acceptedTerms, termsVersion } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const accountRole = role || 'user';
  if (accountRole === 'user' && !acceptedTerms) {
    return res.status(400).json({ error: 'You must accept the Terms of Service to register.' });
  }

  try {
    const user = await dbService.createUser(normalizedEmail, password, accountRole, businessName, {
      acceptedTerms: !!acceptedTerms,
      termsVersion: termsVersion || '1.0',
    });
    if (!user) {
      return res.status(409).json({ error: 'User already exists or invalid data' });
    }
    
    // Auto login
    const result = await dbService.loginUser(normalizedEmail, password);
    await dbService.logAudit(user.id, 'register', `${user.businessName || user.email} <${user.email}> (id:${user.id})`);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const result = await dbService.loginUser(normalizedEmail, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    await dbService.logAudit(result.user.id, 'login', `${result.user.businessName || result.user.email} <${result.user.email}> (id:${result.user.id})`);
    res.json(result);
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  await dbService.logoutUser();
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const row = await dbService.getUserById(user.userId);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

app.put('/api/auth/theme', authenticateToken, async (req, res) => {
  const { userId, theme } = req.body;
  const user = req.user;

  console.log(`--- THEME UPDATE ATTEMPT ---`);
  console.log(`Target User ID: ${userId}`);
  console.log(`New Theme: ${theme}`);
  console.log(`Requesting User: ${user.email} (${user.userId}, Role: ${user.role})`);

  if (userId !== user.userId && user.role !== 'admin') {
    console.warn(`Unauthorized theme update attempt: ${user.email} tried to update ${userId}`);
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.updateUserTheme(userId, theme);
    console.log(`Theme updated in DB for ${userId} to ${theme}`);
    res.json({ message: 'Theme updated successfully' });
  } catch (error) {
    console.error(`Theme update failed for ${userId}:`, error.message);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const { userId, newPassword } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.updateUserPassword(userId, newPassword);
    
    logger.logUserAction('update_password', userId);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Update password error', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to update password' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const token = await dbService.createPasswordReset(normalizedEmail);
    if (token) {
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${base}/?reset=${token}`;
      logger.info('Password reset requested', { email: normalizedEmail, resetUrl });

      const sent = await sendEmail(
        normalizedEmail,
        'Reset your Kawayan password',
        `<p>Someone asked to reset the password for this Kawayan account.</p>
         <p><a href="${resetUrl}">Reset your password</a> — this link expires in 1 hour.</p>
         <p>If you didn't ask for this, you can ignore this email.</p>`
      );

      // Echo the link only when no mail was sent AND we're not in production
      // (so a dev without RESEND_API_KEY can still click through).
      const devResetUrl = !sent && process.env.NODE_ENV !== 'production' ? resetUrl : undefined;
      return res.json({ message: 'If that email exists, a reset link has been sent.', devResetUrl });
    }
    // Same response whether or not the account exists (no enumeration).
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    logger.error('Forgot password error', { error: error.message });
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  try {
    const ok = await dbService.resetPasswordWithToken(token, newPassword);
    if (!ok) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    logger.logUserAction('reset_password', 'via-token');
    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) {
    logger.error('Reset password error', { error: error.message });
    res.status(400).json({ error: error.message || 'Failed to reset password' });
  }
});

// Profiles
app.post('/api/profiles', authenticateToken, async (req, res) => {
  const profile = req.body;
  const user = req.user;
  
  console.log('--- PROFILE SAVE REQUEST ---');
  console.log('User ID from Token:', user.userId);
  console.log('Profile Data Received:', JSON.stringify(profile, null, 2));
  
  if (profile.userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.saveProfile(profile);
    res.json({ message: 'Profile saved successfully' });
  } catch (error) {
    logger.error('Save profile error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/profiles/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;
  
  if (userId !== user.userId && user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const profile = await dbService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (error) {
    logger.error('Get profile error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Posts
app.post('/api/posts', authenticateToken, async (req, res) => {
  const post = req.body;
  const user = req.user;
  
  if (post.userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.savePost(post);
    res.json({ message: 'Post saved successfully' });
  } catch (error) {
    if (error.code === 'TIER_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'TIER_LIMIT_REACHED',
        message: `Monthly post limit of ${error.limit} reached for your subscription tier.`,
        limit: error.limit,
      });
    }
    logger.error('Save post error', { error: error.message });
    res.status(500).json({ error: 'Failed to save post' });
  }
});

app.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const posts = await dbService.getUserPosts(userId);
    res.json(posts);
  } catch (error) {
    logger.error('Get posts error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Plans
app.post('/api/plans', authenticateToken, async (req, res) => {
  const { userId, month, ideas } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.savePlan(userId, month, ideas);
    res.json({ message: 'Plan saved successfully' });
  } catch (error) {
    logger.error('Save plan error', { error: error.message });
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

app.get('/api/plans/:userId/:month', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const month = req.params.month;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const ideas = await dbService.getPlan(userId, month);
    res.json(ideas);
  } catch (error) {
    logger.error('Get plan error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// Errors from third-party APIs (PayMongo, Zernio) carry their own HTTP status.
const sendUpstreamError = (res, error, fallback) => {
  logger.error(fallback, { error: error.message });
  res.status(error.status || 500).json({ error: error.message || fallback });
};

// Wallet & Payments — top-ups go through PayMongo Checkout (docs.paymongo.com).
// The pending CREDIT transaction carries the checkout session id in its description;
// the balance only changes once PayMongo reports that session as paid.
const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PLAN_PRICES = { PRO: 499 };
const TOPUP_MIN = 100;
const TOPUP_MAX = 50000;
const checkoutSessionIdOf = (description = '') => /\((cs_[A-Za-z0-9]+)\)/.exec(description)?.[1];

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

// Credits the user's pending PayMongo top-up once PayMongo says it's paid.
async function settlePendingTopUp(userId) {
  const pending = await dbService.getPendingTransaction(userId);
  const sessionId = checkoutSessionIdOf(pending?.description);
  if (!sessionId) return { status: 'NONE', pending };
  const { data: session } = await paymongo(`/checkout_sessions/${sessionId}`);
  if (session.attributes.payments?.some((p) => p.attributes?.status === 'paid')) {
    try {
      await dbService.approveTransaction(pending.id);
      const who = await dbService.describeUser(userId);
      await dbService.logAudit(userId, 'wallet_topup', `${who} added ₱${pending.amount} via PayMongo (${sessionId})`);
    } catch (error) {
      if (!/not found/i.test(error.message)) throw error; // a parallel request already credited it
    }
    return { status: 'COMPLETED', amount: pending.amount };
  }
  if (session.attributes.status === 'expired') {
    await dbService.failTransaction(pending.id);
    return { status: 'FAILED' };
  }
  return { status: 'PENDING', pending, sessionId, checkoutUrl: session.attributes.checkout_url };
}

app.get('/api/wallet/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const wallet = await dbService.getWallet(userId);
    res.json({ ...wallet, paymentsTestMode: (process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_test_') });
  } catch (error) {
    logger.error('Get wallet error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Start a PayMongo hosted checkout for a wallet top-up.
app.post('/api/wallet/checkout', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
    return res.status(400).json({ error: `Enter a whole amount from ₱${TOPUP_MIN} to ₱${TOPUP_MAX.toLocaleString()}.` });
  }
  try {
    await dbService.getWallet(userId); // expires pending top-ups older than 12h
    if (await dbService.getPendingTransaction(userId)) {
      return res.status(409).json({ error: 'You already have a payment in progress. Finish or cancel it first.' });
    }
    const origin = new URL(req.get('referer') || process.env.APP_URL || `${req.protocol}://${req.get('host')}`).origin;
    const { data: session } = await paymongo('/checkout_sessions', {
      method: 'POST',
      body: {
        data: {
          attributes: {
            line_items: [{ name: 'Kawayan wallet top-up', amount: amount * 100, currency: 'PHP', quantity: 1 }],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            description: `Wallet top-up for ${req.user.email}`,
            reference_number: `${userId}-${Date.now()}`,
            success_url: `${origin}/?success=true`,
            cancel_url: `${origin}/?cancelled=true`,
          },
        },
      },
    });
    await dbService.createTransaction(userId, amount, `Wallet top-up via PayMongo (${session.id})`, 'CREDIT', 'PENDING');
    res.json({ checkoutUrl: session.attributes.checkout_url });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to start checkout');
  }
});

// Called when the user returns from PayMongo (and on Billing load) to credit a paid top-up.
app.post('/api/wallet/verify', authenticateToken, async (req, res) => {
  try {
    const { status, amount, checkoutUrl } = await settlePendingTopUp(req.user.userId);
    res.json({ status, amount, checkoutUrl });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to check payment');
  }
});

app.post('/api/wallet/cancel-transaction', authenticateToken, async (req, res) => {
  const { transactionId } = req.body;
  const userId = req.user.userId;

  try {
    // If PayMongo isn't configured we can't check the session; still let the user clear it locally.
    const result = await settlePendingTopUp(userId).catch((error) => {
      if (error.status === 503) return { status: 'UNCHECKED' };
      throw error;
    });
    if (result.status === 'COMPLETED') {
      return res.status(409).json({ error: `That payment already went through. ₱${result.amount} was added to your wallet.` });
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

app.post('/api/admin/wallet/approve', authenticateToken, requireAdmin, async (req, res) => {
  const { transactionId } = req.body;

  try {
    await dbService.approveTransaction(transactionId);
    res.json({ message: 'Transaction approved and balance updated' });
  } catch (error) {
    logger.error('Approval error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/pending-transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await dbService.getPendingTransactionsAdmin();
    res.json(pending);
  } catch (error) {
    logger.error('Pending transactions error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

app.post('/api/wallet/purchase', authenticateToken, async (req, res) => {
  const { userId, amount, description, plan } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Plan prices come from the server, never the client.
  if (plan && !PLAN_PRICES[plan]) return res.status(400).json({ error: 'Unknown plan' });
  const price = plan ? PLAN_PRICES[plan] : Number(amount);
  if (!(price > 0)) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const wallet = await dbService.getWallet(userId);
    if (wallet.balance < price) {
      return res.status(400).json({ error: `Not enough balance. You need ₱${price}, you have ₱${wallet.balance}.` });
    }

    const planName = plan && plan.charAt(0) + plan.slice(1).toLowerCase();
    await dbService.createTransaction(userId, price, plan ? `${planName} plan (monthly)` : description, 'DEBIT');
    if (plan) {
      await dbService.updateSubscription(userId, plan);
      await dbService.logAudit(userId, 'upgrade_plan', `${await dbService.describeUser(userId)} upgraded to ${plan} for ₱${price}`);
    }

    const updatedWallet = await dbService.getWallet(userId);
    res.json(updatedWallet);
  } catch (error) {
    logger.error('Purchase error', { error: error.message });
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

app.post('/api/wallet/cancel', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.updateSubscription(userId, 'FREE');
    const wallet = await dbService.getWallet(userId);
    res.json(wallet);
  } catch (error) {
    logger.error('Cancel subscription error', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Admin
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  const { start, end } = req.query;
  try {
    const stats = await dbService.getAdminStats(start, end);
    res.json(stats);
  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await dbService.getAuditLogs(limit);
    res.json(logs);
  } catch (error) {
    logger.error('Admin logs error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await dbService.getAllUsers();
    res.json(users);
  } catch (error) {
    logger.error('Admin users error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/tickets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tickets = await dbService.getAllTicketsAdmin();
    res.json(tickets);
  } catch (error) {
    logger.error('Admin tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    await dbService.updateUser(id, data);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Admin update user error', { error: error.message });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.post('/api/admin/balance', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, amount, reason } = req.body;
  try {
    await dbService.adminAdjustBalance(userId, amount, reason);
    res.json({ message: 'Balance adjusted successfully' });
  } catch (error) {
    logger.error('Admin balance error', { error: error.message });
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

app.post('/api/admin/subscription', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, plan, expiresAt } = req.body;
  try {
    await dbService.adminUpdateSubscription(userId, plan, expiresAt);
    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    logger.error('Admin subscription error', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});



// ─────────────────────────────────────────────────────────────────────────────
// Business Verification Routes
// ─────────────────────────────────────────────────────────────────────────────

// Submit verification document (user, called right after registration)
app.post('/api/verification/submit', authenticateToken, uploadVerifDoc.single('document'), async (req, res) => {
  try {
    const { userId, businessAddress, businessPhone } = req.body;
    const requestingUser = req.user;

    // Only allow submitting for self (or admin)
    if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }

    if (!businessAddress || !businessPhone) {
      return res.status(400).json({ error: 'Business address and phone are required' });
    }

    const storagePath = await dbService.uploadVerificationDoc(userId, req.file.buffer, req.file.originalname, req.file.mimetype);
    await dbService.submitVerification(userId, businessAddress, businessPhone, req.file.originalname, storagePath);
    const submitterInfo = await dbService.describeUser(userId);
    await dbService.logAudit(userId, 'submit_verification', `${submitterInfo} — doc:${req.file.originalname}`);
    broadcastVerificationChanged(userId);
    res.status(201).json({ message: 'Verification submitted', status: 'pending' });
  } catch (error) {
    logger.error('Verification submit error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get verification status for a user
app.get('/api/verification/status/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const requestingUser = req.user;
  if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const verif = await dbService.getVerification(userId);
    if (!verif) return res.json({ status: 'none' });
    res.json(verif);
  } catch (error) {
    logger.error('Verification status error', { error: error.message });
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// Re-upload document after rejection (or first submit if no record yet — legacy users)
app.post('/api/verification/resubmit', authenticateToken, uploadVerifDoc.single('document'), async (req, res) => {
  try {
    const { userId, businessAddress, businessPhone } = req.body;
    const requestingUser = req.user;
    if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });

    const storagePath = await dbService.uploadVerificationDoc(userId, req.file.buffer, req.file.originalname, req.file.mimetype);
    const existing = await dbService.getVerification(userId);
    if (!existing) {
      if (!businessAddress || !businessPhone) {
        return res.status(400).json({
          error: 'No verification on file. Provide business address and phone for first-time submission.',
        });
      }
      await dbService.submitVerification(userId, businessAddress, businessPhone, req.file.originalname, storagePath);
    } else {
      await dbService.resubmitVerification(userId, req.file.originalname, storagePath);
    }
    const resubmitterInfo = await dbService.describeUser(userId);
    await dbService.logAudit(userId, 'resubmit_verification', `${resubmitterInfo} — doc:${req.file.originalname}`);
    broadcastVerificationChanged(userId);
    res.json({ message: 'Submitted for review', status: 'pending' });
  } catch (error) {
    logger.error('Verification resubmit error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Admin — get all pending verifications
app.get('/api/admin/verifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await dbService.getAllVerifications();
    res.json(list);
  } catch (error) {
    logger.error('Admin verifications list error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// Admin — approve
app.post('/api/admin/verifications/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
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

// Admin — reject
app.post('/api/admin/verifications/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
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

// Admin — view document file (redirect to a short-lived signed Storage URL)
app.get('/api/admin/verifications/:id/document', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const verif = await dbService.getVerificationById(req.params.id);
    if (!verif) return res.status(404).json({ error: 'Not found' });
    const signedUrl = await dbService.getVerificationDocSignedUrl(verif.document_path);
    res.redirect(signedUrl);
  } catch (error) {
    logger.error('View document error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Audit Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user?.userId || 'anonymous';
    const status = res.statusCode;
    
    logger.info(`Request: ${method} ${url}`, {
      method,
      url,
      status,
      duration,
      userId,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// --- Social publishing via Zernio (docs.zernio.com) ---
// Each Kawayan user maps to one Zernio profile found by name, and each Zernio post
// carries the Kawayan post id in `title` — so no extra DB columns are needed.
const ZERNIO_API = 'https://zernio.com/api/v1';
const SOCIAL_PLATFORMS = ['facebook', 'instagram'];
const zernioProfileIds = new Map();

async function zernio(path, { method = 'GET', body } = {}) {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw Object.assign(new Error('Social posting is not set up yet (ZERNIO_API_KEY is missing).'), { status: 503 });
  const res = await fetch(`${ZERNIO_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never pass Zernio's 401/403 through: the client treats those as an expired Kawayan session.
    const status = [400, 409, 422].includes(res.status) ? 400 : 502;
    throw Object.assign(new Error(data.message || data.error || `Zernio request failed (${res.status})`), { status });
  }
  return data;
}

async function getZernioProfileId(userId) {
  if (zernioProfileIds.has(userId)) return zernioProfileIds.get(userId);
  const name = `kawayan:${userId}`;
  const { profiles = [] } = await zernio(`/profiles?name=${encodeURIComponent(name)}`);
  const id = profiles.find((p) => p.name === name)?._id
    || (await zernio('/profiles', { method: 'POST', body: { name } })).profile._id;
  zernioProfileIds.set(userId, id);
  return id;
}

async function listSocialAccounts(userId) {
  const profileId = await getZernioProfileId(userId);
  const { accounts = [] } = await zernio(`/accounts?profileId=${profileId}`);
  return accounts
    .filter((a) => SOCIAL_PLATFORMS.includes(a.platform))
    .map((a) => ({ id: a._id, platform: a.platform, username: a.username, displayName: a.displayName, isActive: a.isActive }));
}

// Zernio needs a public HTTPS media URL; our AI images are stored as base64 data URLs.
async function toPublicMediaUrl(imageUrl, postId) {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const match = /^data:([^;]+);base64,(.+)$/.exec(imageUrl);
  if (!match) return null;
  const [, contentType, b64] = match;
  const ext = contentType.split('/')[1] || 'png';
  const { uploadUrl, publicUrl } = await zernio('/media/presign', {
    method: 'POST',
    body: { filename: `kawayan-${postId}.${ext}`, contentType },
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: Buffer.from(b64, 'base64') });
  if (!put.ok) throw Object.assign(new Error(`Image upload failed (${put.status})`), { status: 502 });
  return publicUrl;
}

const firstPlatformUrl = (zPost) => zPost.platforms?.find((p) => p.platformPostUrl)?.platformPostUrl;

app.get('/api/social/accounts', authenticateToken, async (req, res) => {
  try {
    res.json(await listSocialAccounts(req.user.userId));
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to load social accounts');
  }
});

app.get('/api/social/connect/:platform', authenticateToken, async (req, res) => {
  const { platform } = req.params;
  if (!SOCIAL_PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Unsupported platform' });
  try {
    const profileId = await getZernioProfileId(req.user.userId);
    // Send the user back to whichever host they started from (localhost in dev, the live URL in prod).
    const origin = new URL(req.get('referer') || process.env.APP_URL || `${req.protocol}://${req.get('host')}`).origin;
    const redirect = encodeURIComponent(`${origin}/?social=${platform}`);
    const { authUrl } = await zernio(`/connect/${platform}?profileId=${profileId}&redirect_url=${redirect}`);
    res.json({ authUrl });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to start account connection');
  }
});

app.delete('/api/social/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const account = (await listSocialAccounts(req.user.userId)).find((a) => a.id === req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await zernio(`/accounts/${account.id}`, { method: 'DELETE' });
    const who = await dbService.describeUser(req.user.userId);
    await dbService.logAudit(req.user.userId, 'disconnect_social', `${who} disconnected ${account.platform} @${account.username}`);
    res.json({ message: 'Disconnected' });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to disconnect account');
  }
});

// Publish now, or schedule when `scheduledFor` (local "YYYY-MM-DDTHH:mm:ss" in `timezone`) is given.
app.post('/api/social/publish', authenticateToken, async (req, res) => {
  const { postId, accountIds, scheduledFor, timezone } = req.body;
  if (!postId || !Array.isArray(accountIds) || accountIds.length === 0) {
    return res.status(400).json({ error: 'Pick at least one account to post to.' });
  }
  try {
    const post = (await dbService.getUserPosts(req.user.userId)).find((p) => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Post not found. Save it first.' });
    const accounts = (await listSocialAccounts(req.user.userId)).filter((a) => accountIds.includes(a.id));
    if (accounts.length !== accountIds.length) return res.status(400).json({ error: 'One of the selected accounts is no longer connected.' });

    const mediaUrl = await toPublicMediaUrl(post.imageUrl, post.id);
    const { post: zPost } = await zernio('/posts', {
      method: 'POST',
      body: {
        title: post.id,
        content: post.caption,
        ...(mediaUrl ? { mediaItems: [{ url: mediaUrl, type: 'image' }] } : {}),
        platforms: accounts.map((a) => ({ platform: a.platform, accountId: a.id })),
        ...(scheduledFor ? { scheduledFor, timezone: timezone || 'Asia/Manila' } : { publishNow: true }),
      },
    });

    const published = zPost.status === 'published' || zPost.status === 'partial';
    const updated = published
      ? { ...post, status: 'Published', publishedAt: zPost.publishedAt || new Date().toISOString(), externalLink: firstPlatformUrl(zPost) || post.externalLink }
      : { ...post, status: 'Scheduled' };
    await dbService.savePost(updated);

    const who = await dbService.describeUser(req.user.userId);
    const where = accounts.map((a) => `${a.platform} @${a.username}`).join(', ');
    await dbService.logAudit(
      req.user.userId,
      published ? 'publish_post' : 'schedule_post',
      `${who} ${published ? 'published' : `scheduled for ${scheduledFor} (${timezone || 'Asia/Manila'})`} "${post.topic}" to ${where}`
    );
    res.json(updated);
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to publish post');
  }
});

// Pull back publish results for scheduled posts (matched by Zernio post title = Kawayan post id).
app.post('/api/social/sync', authenticateToken, async (req, res) => {
  try {
    const scheduled = (await dbService.getUserPosts(req.user.userId)).filter((p) => p.status === 'Scheduled');
    if (scheduled.length === 0) return res.json({ published: 0, failed: 0 });
    const profileId = await getZernioProfileId(req.user.userId);
    const { posts: zPosts = [] } = await zernio(`/posts?profileId=${profileId}&limit=500`);
    let published = 0;
    let failed = 0;
    for (const post of scheduled) {
      const z = zPosts.find((zp) => zp.title === post.id);
      if (!z) continue;
      if (z.status === 'published' || z.status === 'partial') {
        await dbService.savePost({ ...post, status: 'Published', publishedAt: z.publishedAt || new Date().toISOString(), externalLink: firstPlatformUrl(z) || post.externalLink });
        published++;
      } else if (z.status === 'failed') {
        await dbService.savePost({ ...post, status: 'Draft' });
        failed++;
      }
    }
    res.json({ published, failed });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to sync post status');
  }
});

// --- Support Routes ---

app.get('/api/support/tickets', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const tickets = (user.role === 'admin' || user.role === 'support')
      ? await dbService.getAllTicketsAdmin() 
      : await dbService.getTickets(user.userId);
    res.json(tickets);
  } catch (error) {
    logger.error('Get tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.post('/api/support/tickets', authenticateToken, async (req, res) => {
  const { subject, priority, message, category } = req.body;
  const user = req.user;

  try {
    const ticketNum = await dbService.getNextTicketNum();

    const ticket = {
      id: Date.now().toString(),
      ticketNum,
      userId: user.userId,
      userEmail: user.email,
      subject,
      category: ['Technical', 'Billing', 'General'].includes(category) ? category : 'General',
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

app.put('/api/support/tickets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, messages } = req.body;
  const user = req.user;

  try {
    // Verify ownership or admin
    // For simplicity, assuming if they have ID they can append user message, 
    // but ideally we check ownership.
    // Since we don't have a "getTicketById" readily exposed to check owner, 
    // we rely on the client being good or add a check in DB service.
    
    await dbService.updateTicket(id, status, messages);
    
    logger.logUserAction('update_ticket', user.userId, { ticketId: id, status });
    await broadcastTicket(id);
    
    const ticket = await dbService.getTicketById(id);
    res.json(ticket || { message: 'Ticket updated' });
  } catch (error) {
    logger.error('Update ticket error', { error: error.message });
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.post('/api/support/tickets/resolve-user', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  try {
    await dbService.resolveTicketByUserId(userId);
    const tickets = await dbService.getTickets(userId);
    for (const t of tickets) {
      if (t.status === 'Resolved') {
        io.to('support-staff').emit('ticket:updated', t);
        io.to(`user-${userId}`).emit('ticket:updated', t);
      }
    }
    res.json({ message: 'User tickets resolved' });
  } catch (error) {
    logger.error('Resolve user tickets error', { error: error.message });
    res.status(500).json({ error: 'Failed to resolve tickets' });
  }
});

// --- Active Call Routes ---

app.get('/api/support/calls', authenticateToken, async (req, res) => {
  try {
    const calls = await dbService.getActiveCalls();
    res.json(calls);
  } catch (error) {
    logger.error('Get calls error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
});

app.get('/api/support/call-history', authenticateToken, async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const history = await dbService.getCallHistory();
    res.json(history);
  } catch (error) {
    logger.error('Get call history error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

app.post('/api/support/calls/register', authenticateToken, async (req, res) => {
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

app.post('/api/support/calls/unregister', authenticateToken, async (req, res) => {
  const user = req.user;
  const { agentId } = req.body;
  try {
    await dbService.unregisterCall(user.userId, agentId);
    broadcastCallsChanged();
    res.json({ message: 'Call unregistered' });
  } catch (error) {
    logger.error('Unregister call error', { error: error.message });
    res.status(500).json({ error: 'Failed to unregister call' });
  }
});

// --- Text AI (content plans, captions, trending topics, support bot) ---
// Any OpenAI-compatible chat API works. Providers are tried in order and the next one takes
// over on a quota error, outage or timeout, so one free tier running dry doesn't stop a demo.
// Default: OpenAI's open-weight gpt-oss-120b on Cloudflare Workers AI, the same account the
// images use (about 100 month plans a day on the free allocation). Setting GROQ_API_KEY puts
// Groq first: same model, a few times faster, with its own free daily limit.
const TEXT_AI_PROVIDERS = [
  process.env.GROQ_API_KEY && {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN && {
    name: 'Cloudflare Workers AI',
    url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
    key: process.env.CLOUDFLARE_API_TOKEN,
    model: process.env.CLOUDFLARE_TEXT_MODEL || '@cf/openai/gpt-oss-120b',
  },
].filter(Boolean);

app.post('/api/ai/text', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  if (TEXT_AI_PROVIDERS.length === 0) return res.status(503).json({ error: 'AI service not configured', degraded: true });

  let rateLimited = false;
  for (const provider of TEXT_AI_PROVIDERS) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
        // Cloudflare stops at 256 tokens unless told otherwise, which cuts a month plan mid-JSON.
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
        signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45000),
      });
      if (!response.ok) {
        rateLimited ||= response.status === 429;
        throw new Error(`${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response');
      return res.json({ text });
    } catch (error) {
      logger.warn('Text AI provider failed', { provider: provider.name, message: error?.message });
    }
  }
  // Every provider failed. The calendar shows its daily-limit notice when the error mentions "quota".
  res.status(rateLimited ? 429 : 503).json({ error: rateLimited ? 'AI quota reached for today' : 'AI service unavailable', degraded: true });
});

// --- Cloudflare Workers AI Image Proxy (post images, free tier) ---
app.post('/api/ai/cloudflare-image', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return res.status(503).json({ error: 'Image service not configured', degraded: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 30000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Cloudflare Workers AI error: ${response.status} - ${errText}`);
    }

    // Success returns the raw image bytes (image/png), not JSON.
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    res.json({ imageUrl: dataUrl });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    logger.warn('Cloudflare image proxy error', { aborted, message: error?.message });
    res.status(503).json({ error: aborted ? 'Image request timed out' : 'Image service unavailable', degraded: true });
  } finally {
    clearTimeout(timeout);
  }
});

// API 404 handler — must be before the React catch-all
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// The "catchall" handler: any non-API request → React's index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// ── Global error handler ─────────────────────────────────────────────
// Anything a route (or the wrap() helper) forwards via next(err) lands
// here as a clean JSON response instead of a hung / crashed request.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const locked = /SQLITE_BUSY|database is locked/i.test(err?.message || '');
  logger.error('Unhandled request error', { path: req.originalUrl, message: err?.message, locked });
  if (res.headersSent) return;
  res.status(locked ? 503 : 500).json({
    error: locked ? 'The database is busy, please retry.' : 'Internal server error',
    retryable: locked,
  });
});

// ── Start + graceful shutdown ────────────────────────────────────────
httpServer.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`Server running on http://localhost:${port}`);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    try { dbService.close(); } catch (e) { logger.error('DB close failed', { error: e?.message }); }
    process.exit(0);
  });
  // Don't hang forever if a connection is stuck.
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
