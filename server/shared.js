import { z } from 'zod';
import { SupabaseService } from '../src/services/supabaseService.ts';
import { JWTService } from '../src/services/jwtService.ts';
import { logger } from '../src/utils/logger.ts';

export const dbService = new SupabaseService();

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  const payload = JWTService.verifyToken(token);
  if (!payload) return res.sendStatus(403);

  req.user = payload;
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

export const isStaff = (user) => user.role === 'admin' || user.role === 'support';

export const requireStaff = (req, res, next) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });
  next();
};

// Users act on their own records; admins can act on anyone's.
export const isSelfOrAdmin = (user, userId) => userId === user.userId || user.role === 'admin';

// Replaces req.body with the parsed copy, so unknown fields never reach the database.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    return res.status(400).json({ error: issue.message, field: issue.path.join('.') || undefined });
  }
  req.body = result.data;
  next();
};

// A required, trimmed string whose missing/empty message is `message`.
export const text = (message, max = 1000) => z.string({ error: message }).trim().min(1, message).max(max);
export const id = text('An id is required', 100);

// Errors from third-party APIs (PayMongo, Zernio) carry their own HTTP status.
export const sendUpstreamError = (res, error, fallback) => {
  logger.error(fallback, { error: error.message });
  res.status(error.status || 500).json({ error: error.message || fallback });
};

// Where to send the browser back to after PayMongo / Zernio (localhost in dev, the live URL in prod).
export const originOf = (req) =>
  new URL(req.get('referer') || process.env.APP_URL || `${req.protocol}://${req.get('host')}`).origin;
