import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { sendEmail } from '../../src/utils/mailer.ts';
import { dbService, authenticateToken, validate, text, id, isSelfOrAdmin } from '../shared.js';

const router = Router();

const email = (message) => text(message, 254).toLowerCase();
const password = (message) => z.string({ error: message }).min(1, message).max(200);

const registerSchema = z.object({
  email: email('Email and password are required').pipe(z.email('Enter a valid email address')),
  password: password('Email and password are required'),
  businessName: z.string().trim().max(200).optional(),
  acceptedTerms: z.literal(true, 'You must accept the Terms of Service to register.'),
  termsVersion: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: email('Email and password are required'),
  password: password('Email and password are required'),
});

const themeSchema = z.object({ userId: id, theme: z.enum(['light', 'dark']) });
const passwordSchema = z.object({ userId: id, newPassword: password('A new password is required') });
const forgotSchema = z.object({ email: email('Email is required') });
const resetSchema = z.object({
  token: text('Token and new password are required', 200),
  newPassword: password('Token and new password are required'),
});

router.post('/api/auth/register', validate(registerSchema), async (req, res) => {
  const { email, password, businessName, termsVersion } = req.body;

  try {
    // Sign-up only ever makes business accounts; admin and support are set in the database.
    const user = await dbService.createUser(email, password, 'user', businessName, {
      acceptedTerms: true,
      termsVersion: termsVersion || '1.0',
    });
    if (!user) {
      return res.status(409).json({ error: 'User already exists or invalid data' });
    }

    // Auto login
    const result = await dbService.loginUser(email, password);
    await dbService.logAudit(user.id, 'register', `${user.businessName || user.email} <${user.email}> (id:${user.id})`);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/auth/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await dbService.loginUser(email, password);
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

router.post('/api/auth/logout', async (req, res) => {
  await dbService.logoutUser();
  res.json({ message: 'Logged out successfully' });
});

router.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const row = await dbService.getUserById(req.user.userId);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

router.put('/api/auth/theme', authenticateToken, validate(themeSchema), async (req, res) => {
  const { userId, theme } = req.body;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.updateUserTheme(userId, theme);
    res.json({ message: 'Theme updated successfully' });
  } catch (error) {
    logger.error('Theme update error', { userId, error: error.message });
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

router.put('/api/auth/password', authenticateToken, validate(passwordSchema), async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.updateUserPassword(userId, newPassword);
    logger.logUserAction('update_password', userId);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Update password error', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to update password' });
  }
});

router.post('/api/auth/forgot-password', validate(forgotSchema), async (req, res) => {
  const { email } = req.body;
  try {
    const token = await dbService.createPasswordReset(email);
    if (token) {
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${base}/?reset=${token}`;
      logger.info('Password reset requested', { email, resetUrl });

      const sent = await sendEmail(
        email,
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

router.post('/api/auth/reset-password', validate(resetSchema), async (req, res) => {
  const { token, newPassword } = req.body;
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

export default router;
