// Loads .env before the route modules below read process.env.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { logger } from './src/utils/logger.ts';
import { dbService } from './server/shared.js';
import { io } from './server/realtime.js';
import authRoutes from './server/routes/auth.js';
import postRoutes from './server/routes/posts.js';
import paymentRoutes from './server/routes/payments.js';
import adminRoutes from './server/routes/admin.js';
import verificationRoutes from './server/routes/verification.js';
import socialRoutes from './server/routes/social.js';
import supportRoutes from './server/routes/support.js';
import aiRoutes from './server/routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3001;

const app = express();
const httpServer = createServer(app);
io.attach(httpServer);

// ── Process-level safety net ─────────────────────────────────────────
// A thrown error in an un-awaited promise used to take the whole server
// down (→ ECONNREFUSED for the client). Log and keep serving instead.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception (server kept alive)', { error: err?.message, stack: err?.stack });
});

// Trust proxy (required for Render and similar hosts to get the correct protocol/host)
app.set('trust proxy', true);

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

// Request log
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`Request: ${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.userId || 'anonymous',
      userAgent: req.get('user-agent')
    });
  });
  next();
});

app.get('/api/health', async (req, res) => {
  res.json(await dbService.healthCheck());
});

app.use(authRoutes);
app.use(postRoutes);
app.use(paymentRoutes);
app.use(adminRoutes);
app.use(verificationRoutes);
app.use(socialRoutes);
app.use(supportRoutes);
app.use(aiRoutes);

// API 404 handler — must be before the React catch-all
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// The "catchall" handler: any non-API request → React's index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// ── Global error handler ─────────────────────────────────────────────
// Anything a route forwards via next(err) lands here as a clean JSON
// response instead of a hung / crashed request.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled request error', { path: req.originalUrl, message: err?.message });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
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
