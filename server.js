import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { DatabaseService } from './services/databaseService.ts';
import { JWTService } from './services/jwtService.ts';
import { logger } from './utils/logger.ts';

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
});

// Trust proxy (required for Codespaces/Heroku/etc to get correct protocol/host)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());

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
const dbService = new DatabaseService();

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
const uploadDir = path.join(__dirname, 'uploads', 'verifications');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const verificationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `verif_${Date.now()}${ext}`);
  }
});

const uploadVerifDoc = multer({
  storage: verificationStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
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
  const { email, password, role, businessName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await dbService.createUser(email, password, role, businessName);
    if (!user) {
      return res.status(409).json({ error: 'User already exists or invalid data' });
    }
    
    // Auto login
    const result = await dbService.loginUser(email, password);
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

  try {
    const result = await dbService.loginUser(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
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
    const db = dbService['dbConfig'].getDatabase();
    const row = db.prepare('SELECT id, email, role, business_name, theme FROM users WHERE id = ?').get(user.userId);
    if (!row) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      id: row.id,
      email: row.email,
      role: row.role,
      businessName: row.business_name,
      theme: row.theme
    });
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

// Wallet & Payments
app.get('/api/wallet/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin' && user.role !== 'support') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const wallet = await dbService.getWallet(userId);
    res.json(wallet);
  } catch (error) {
    logger.error('Get wallet error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

app.post('/api/wallet/cancel-transaction', authenticateToken, async (req, res) => {
  const { transactionId } = req.body;
  const user = req.user;

  try {
    await dbService.cancelTransaction(transactionId, user.userId);
    const wallet = await dbService.getWallet(user.userId);
    res.json(wallet);
  } catch (error) {
    logger.error('Cancel transaction error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/verify-payment', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const db = dbService['dbConfig'].getDatabase();
    const pendingTxn = db.prepare("SELECT * FROM transactions WHERE user_id = ? AND status = 'PENDING'").get(user.userId);

    if (!pendingTxn) {
      return res.json({ status: 'NO_PENDING', message: "No pending transaction found." });
    }

    const match = pendingTxn.description.match(/Xendit Invoice: (invoice_.*)/);
    if (!match) {
       return res.json({ status: 'PENDING', message: "Pending transaction is not verifiable via Xendit." });
    }
    const externalId = match[1];

    const xenditSecret = process.env.XENDIT_SECRET_KEY;
    const response = await fetch(`https://api.xendit.co/v2/invoices?external_id=${externalId}`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(xenditSecret + ':').toString('base64')
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to reach payment provider');
    }
    
    const data = await response.json();

    if (data && data.length > 0) {
        const invoice = data[0];
        if (invoice.status === 'PAID' || invoice.status === 'SETTLED') {
            await dbService.approveTransaction(pendingTxn.id);
            return res.json({ status: 'COMPLETED', message: 'Payment verified and balance updated.' });
        } else if (invoice.status === 'EXPIRED') {
             db.prepare("UPDATE transactions SET status = 'FAILED' WHERE id = ?").run(pendingTxn.id);
             return res.json({ status: 'FAILED', message: 'Payment expired.' });
        }
    }

    res.json({ status: 'PENDING', message: 'Payment not yet confirmed by provider.' });

  } catch (error) {
    logger.error('Verify payment error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/create-invoice', authenticateToken, async (req, res) => {
  const { userId, amount, clientOrigin } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const externalId = `invoice_${userId}_${Date.now()}`;
    const xenditSecret = process.env.XENDIT_SECRET_KEY;
    const authHeader = 'Basic ' + Buffer.from(xenditSecret + ':').toString('base64');

    // Determine the base URL dynamically
    // Priority: Client-provided Origin (Most reliable for SPAs) -> Headers -> Fallback
    const origin = req.get('origin');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = clientOrigin || origin || `${protocol}://${host}`;
    
    logger.info(`Creating Xendit Invoice. Base URL determined as: ${baseUrl}`);

    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: Number(amount),
        currency: 'PHP',
        customer: {
          email: user.email
        },
        success_redirect_url: `${baseUrl}/billing?success=true`,
        failure_redirect_url: `${baseUrl}/billing?failed=true`
      })
    });

    const invoice = await response.json();
    
    if (!response.ok) {
      logger.error('Xendit API Failure', { status: response.status, data: invoice });
      throw new Error(invoice.message || 'Xendit Invoice creation failed');
    }

    // Create a pending transaction record
    await dbService.createTransaction(userId, amount, `Xendit Invoice: ${externalId}`, 'CREDIT', 'PENDING');

    res.json({
      checkoutUrl: invoice.invoice_url,
      externalId: externalId
    });
  } catch (error) {
    logger.error('Xendit Invoice error', { error: error.message });
    res.status(500).json({ error: 'Failed to create payment invoice' });
  }
});

// Xendit Webhook Handler
app.post('/api/webhooks/xendit', async (req, res) => {
  // ... (existing code)
});

// --- Social Auth Token Exchange ---

app.post('/api/auth/facebook/callback', async (req, res) => {
  // ... (existing facebook code)
});

app.post('/api/auth/tiktok/callback', async (req, res) => {
  const { code, redirectUri } = req.body;
  const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  try {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    // Get user info to show in the dashboard (Display API)
    const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`
      }
    });
    const userData = await userResponse.json();

    res.json({
      accessToken: data.access_token,
      user: userData.data?.user || {}
    });
  } catch (error) {
    logger.error('TikTok Auth Error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/topup', authenticateToken, async (req, res) => {
  const { userId, amount, description } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Top-ups are now PENDING by default for manual verification
    await dbService.createTransaction(userId, amount, description || 'Wallet Top-up', 'CREDIT', 'PENDING');
    const wallet = await dbService.getWallet(userId);
    res.json(wallet);
  } catch (error) {
    logger.error('Topup error', { error: error.message });
    res.status(500).json({ error: 'Failed to initiate top up' });
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

app.post('/api/wallet/xendit-checkout', authenticateToken, async (req, res) => {
  const { userId, type, amount, method, plan, clientOrigin } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const validMethods = ['GCASH', 'MAYA', 'CARD'];
  const paymentMethod = validMethods.includes(method) ? method : 'GCASH';
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const externalId = `invoice_${userId}_${Date.now()}`;
  const methodLabel = paymentMethod === 'GCASH' ? 'GCash' : paymentMethod === 'MAYA' ? 'Maya' : 'Card';
  const xenditSecret = process.env.XENDIT_SECRET_KEY;
  const hasLiveXendit =
    xenditSecret &&
    !xenditSecret.includes('your_') &&
    xenditSecret.length > 8;

  try {
    if (type === 'topup' && hasLiveXendit) {
      const authHeader = 'Basic ' + Buffer.from(xenditSecret + ':').toString('base64');
      const origin = req.get('origin');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const baseUrl = clientOrigin || origin || `${protocol}://${host}`;

      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: externalId,
          amount: numericAmount,
          currency: 'PHP',
          customer: { email: user.email },
          success_redirect_url: `${baseUrl}/billing?success=true`,
          failure_redirect_url: `${baseUrl}/billing?failed=true`,
        }),
      });

      const invoice = await response.json();

      if (response.ok && invoice.invoice_url) {
        await dbService.createTransaction(
          userId,
          numericAmount,
          `Xendit Invoice: ${externalId}`,
          'CREDIT',
          'PENDING'
        );
        logger.logUserAction('xendit_checkout_redirect', userId, { externalId, amount: numericAmount });
        return res.json({
          mode: 'redirect',
          checkoutUrl: invoice.invoice_url,
          externalId,
        });
      }

      logger.warn('Xendit invoice failed, using local checkout completion', { status: response.status });
    }

    if (type === 'subscription') {
      const wallet = await dbService.getWallet(userId);
      if (wallet.balance < numericAmount) {
        return res.status(400).json({ error: 'Insufficient balance. Please top up your wallet first.' });
      }
      await dbService.createTransaction(
        userId,
        numericAmount,
        `Xendit Wallet · Pro Subscription via ${methodLabel} (${externalId})`,
        'DEBIT',
        'COMPLETED'
      );
      await dbService.updateSubscription(userId, plan || 'PRO');
    } else {
      await dbService.createTransaction(
        userId,
        numericAmount,
        `Xendit Invoice: ${externalId} · ${methodLabel}`,
        'CREDIT',
        'COMPLETED'
      );
    }

    const updatedWallet = await dbService.getWallet(userId);
    logger.logUserAction('xendit_checkout_completed', userId, {
      type,
      amount: numericAmount,
      method: paymentMethod,
      externalId,
    });

    res.json({
      mode: 'completed',
      wallet: updatedWallet,
      receipt: {
        referenceId: externalId,
        method: paymentMethod,
        amount: numericAmount,
        type: type || 'topup',
        plan: plan || undefined,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Xendit checkout error', { error: error.message });
    res.status(500).json({ error: error.message || 'Payment could not be completed' });
  }
});

app.post('/api/wallet/purchase', authenticateToken, async (req, res) => {
  const { userId, amount, description, plan } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const wallet = await dbService.getWallet(userId);
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await dbService.createTransaction(userId, amount, description, 'DEBIT');
    if (plan) {
      await dbService.updateSubscription(userId, plan);
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
    await dbService.deleteUser(id);
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

// Serve uploaded verification documents (admin only)
app.use('/uploads/verifications', authenticateToken, requireAdmin, express.static(uploadDir));

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

    await dbService.submitVerification(userId, businessAddress, businessPhone, req.file.originalname, req.file.filename);
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

// Re-upload document after rejection
app.post('/api/verification/resubmit', authenticateToken, uploadVerifDoc.single('document'), async (req, res) => {
  try {
    const { userId } = req.body;
    const requestingUser = req.user;
    if (requestingUser.userId !== userId && requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });

    await dbService.resubmitVerification(userId, req.file.originalname, req.file.filename);
    res.json({ message: 'Resubmitted for review', status: 'pending' });
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
    await dbService.approveVerification(id, req.user.userId);
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
    await dbService.rejectVerification(id, req.user.userId, reason || '');
    res.json({ message: 'Verification rejected' });
  } catch (error) {
    logger.error('Reject verification error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Admin — view document file (stream the file)
app.get('/api/admin/verifications/:id/document', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const verif = await dbService.getVerificationById(req.params.id);
    if (!verif) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadDir, verif.document_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.sendFile(filePath);
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

// --- Social Routes (DB Persisted) ---

app.get('/api/social/connections', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const connections = await dbService.getSocialConnections(user.userId);
    res.json(connections);
  } catch (error) {
    logger.error('Get social connections error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

app.post('/api/social/connections', authenticateToken, async (req, res) => {
  const { platform, data } = req.body;
  const user = req.user;

  try {
    // Ensure the data object has the username/platform set
    const connectionData = {
      ...data,
      connected: true,
      platform
    };
    
    await dbService.saveSocialConnection(user.userId, platform, connectionData);
    
    // Log the audit
    logger.logUserAction('connect_social_account', user.userId, { platform });
    
    res.json({ message: 'Connection saved' });
  } catch (error) {
    logger.error('Save social connection error', { error: error.message });
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

app.delete('/api/social/connections/:platform', authenticateToken, async (req, res) => {
  const { platform } = req.params;
  const user = req.user;

  try {
    // We can "soft delete" by setting connected = 0, or hard delete?
    // Let's set connected = false for now so we keep history?
    // Actually, `saveSocialConnection` handles update.
    
    const data = { connected: false };
    await dbService.saveSocialConnection(user.userId, platform, data);
    
    logger.logUserAction('disconnect_social_account', user.userId, { platform });
    
    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    logger.error('Disconnect social error', { error: error.message });
    res.status(500).json({ error: 'Failed to disconnect' });
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
    
    res.json({ message: 'Ticket updated' });
  } catch (error) {
    logger.error('Update ticket error', { error: error.message });
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.post('/api/support/tickets/resolve-user', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  try {
    await dbService.resolveTicketByUserId(userId);
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
    res.json({ message: 'Call unregistered' });
  } catch (error) {
    logger.error('Unregister call error', { error: error.message });
    res.status(500).json({ error: 'Failed to unregister call' });
  }
});

// --- Social Media Scraper Helper ---
async function scrapeSocialStats(platform, username) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  ];
  
  const headers = {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    if (platform === 'instagram') {
      // 1. Imginn (Public Viewer)
      try {
        const response = await fetch(`https://imginn.com/${username}/`, { headers });
        if (response.ok) {
          const html = await response.text();
          const followersMatch = html.match(/<span class="followers">([0-9.,kKmM]+)<\/span>/i) ||
                                 html.match(/Followers\s*<[^>]+>\s*([0-9.,kKmM]+)/i);
          if (followersMatch) {
            return { followers: parseSocialNumber(followersMatch[1]), isReal: true, source: 'imginn' };
          }
        }
      } catch (e) { logger.warn(`Imginn failed: ${e.message}`); }

      // 2. GreatFon/InstaNavigation Fallback
      const response2 = await fetch(`https://greatfon.com/v/${username}`, { headers });
      if (response2.ok) {
        const html = await response2.text();
        const followersMatch = html.match(/Followers\s*<[^>]+>\s*([0-9.,kKmM]+)/i) ||
                               html.match(/<li[^>]*>\s*([0-9.,kKmM]+)\s*<span>Followers<\/span>/i);
        if (followersMatch) {
          return { followers: parseSocialNumber(followersMatch[1]), isReal: true, source: 'greatfon' };
        }
      }

    } else if (platform === 'tiktok') {
      const cleanUser = username.startsWith('@') ? username.substring(1) : username;
      
      // 1. TikWM Public API (JSON)
      try {
        const response = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${cleanUser}`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.code === 0 && data.data && data.data.user) {
             return {
               followers: data.data.user.follower_count,
               likes: data.data.user.total_favorited,
               isReal: true,
               source: 'tikwm-api'
             };
          }
        }
      } catch (e) { logger.warn(`TikWM failed: ${e.message}`); }

      // 2. Countik API (often open)
      try {
        const response2 = await fetch(`https://countik.com/api/user/${cleanUser}`, { headers });
        if (response2.ok) {
           const data = await response2.json();
           if (data && data.followerCount) {
             return {
               followers: parseSocialNumber(data.followerCount),
               likes: parseSocialNumber(data.heartCount),
               isReal: true,
               source: 'countik-api'
             };
           }
        }
      } catch (e) { logger.warn(`Countik failed: ${e.message}`); }

      // 3. Urlebird Fallback
      const response3 = await fetch(`https://urlebird.com/user/@${cleanUser}/`, { headers });
      if (response3.ok) {
         const html = await response3.text();
         const followersMatch = html.match(/>\s*([0-9.,kKmM]+)\s*<\/b>\s*Followers/i);
         if (followersMatch) {
            return { followers: parseSocialNumber(followersMatch[1]), isReal: true, source: 'urlebird' };
         }
      }

    } else if (platform === 'facebook') {
       // FB Public Page Scraping
       const response = await fetch(`https://www.facebook.com/${username}`, { headers });
       if (response.ok) {
         const html = await response.text();
         const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                           html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
                           
         if (metaMatch) {
           const content = metaMatch[1];
           const followersMatch = content.match(/([0-9.,kKmM]+)\s+followers/i);
           const likesMatch = content.match(/([0-9.,kKmM]+)\s+likes/i);
           
           if (followersMatch) {
             return {
               followers: parseSocialNumber(followersMatch[1]),
               likes: parseSocialNumber(likesMatch ? likesMatch[1] : '0'),
               isReal: true,
               source: 'facebook-meta'
             };
           }
         }
       }
    }
    
    throw new Error('All scraping methods failed');

  } catch (error) {
    logger.warn(`Scraping failed for ${platform}/${username}: ${error.message}`);
    // Return error state - no fake data
    return {
      error: error.message,
      isReal: false,
      followers: null,
      engagement: null
    };
  }
}

function parseSocialNumber(str) {
  if (!str) return 0;
  str = str.toUpperCase().replace(/,/g, '');
  if (str.includes('K')) return parseFloat(str) * 1000;
  if (str.includes('M')) return parseFloat(str) * 1000000;
  if (str.includes('B')) return parseFloat(str) * 1000000000;
  return parseFloat(str);
}

// Route for stats

app.get('/api/social/stats/:platform/:username', async (req, res) => {

  const { platform, username } = req.params;

  const data = await scrapeSocialStats(platform, username);

  res.json(data);

});



// --- Local AI Proxy ---
app.post('/api/ai/local', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) throw new Error("Local AI Server Offline");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: "Local AI currently unavailable" });
  }
});

// --- Unsloth AI Proxy ---
app.post('/api/ai/unsloth', async (req, res) => {
  try {
    const url = process.env.UNSLOTH_API_URL || 'https://sharp-spies-doubt.loca.lt/v1/chat/completions';
    const token = process.env.UNSLOTH_API_KEY || 'sk-unsloth-2ac78b9fd6f6d5f70b0b3f752a73ba60';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Unsloth API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Unsloth AI Proxy failed:", error);
    res.status(503).json({ error: "Unsloth AI currently unavailable" });
  }
});

// API 404 Handler - Must be before the React catch-all



app.use('/api', (req, res) => {



  res.status(404).json({ error: 'API endpoint not found' });



});



// The "catchall" handler: for any request that doesn't

// match one above, send back React's index.html file.

app.use((req, res) => {



  res.sendFile(path.join(__dirname, 'dist/index.html'));



});







// Start Server
httpServer.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`Server running on http://localhost:${port}`);
});
