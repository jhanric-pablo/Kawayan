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
