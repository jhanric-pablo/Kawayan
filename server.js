import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from './services/databaseService.ts';
import { JWTService } from './services/jwtService.ts';
import { logger } from './utils/logger.ts';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
  res.json(user);
});

app.put('/api/auth/theme', authenticateToken, async (req, res) => {
  const { userId, theme } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.updateUserTheme(userId, theme);
    res.json({ message: 'Theme updated successfully' });
  } catch (error) {
    logger.error('Update theme error', { error: error.message });
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Profiles
app.post('/api/profiles', authenticateToken, async (req, res) => {
  const profile = req.body;
  const user = req.user;
  if (profile.userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await dbService.saveProfile(profile);
    res.json({ message: 'Profile saved successfully' });
  } catch (error) {
    logger.error('Save profile error', { error: error.message });
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

app.get('/api/profiles/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;
  
  if (userId !== user.userId && user.role !== 'admin') {
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
    logger.error('Save post error', { error: error.message });
    res.status(500).json({ error: 'Failed to save post' });
  }
});

app.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
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

  if (userId !== user.userId && user.role !== 'admin') {
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

  if (userId !== user.userId && user.role !== 'admin') {
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

app.post('/api/wallet/create-invoice', authenticateToken, async (req, res) => {
  const { userId, amount } = req.body;
  const user = req.user;

  if (userId !== user.userId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const externalId = `invoice_${userId}_${Date.now()}`;
    const xenditSecret = process.env.XENDIT_SECRET_KEY;
    const authHeader = 'Basic ' + Buffer.from(xenditSecret + ':').toString('base64');

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
        success_redirect_url: `${req.protocol}://${req.get('host')}/billing?success=true`,
        failure_redirect_url: `${req.protocol}://${req.get('host')}/billing?failed=true`
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

  try {

    const stats = await dbService.getAdminStats();

    res.json(stats);

  } catch (error) {

    logger.error('Admin stats error', { error: error.message });

    res.status(500).json({ error: 'Failed to fetch stats' });

  }

});



// The "catchall" handler: for any request that doesn't



// match one above, send back React's index.html file.



app.use((req, res) => {



  res.sendFile(path.join(__dirname, 'dist/index.html'));



});







// Start Server



app.listen(port, () => {





  logger.info(`Server running on port ${port}`);

  console.log(`Server running on http://localhost:${port}`);

});
