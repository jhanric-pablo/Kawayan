// Business verification: the user uploads a business document; an admin reviews it (see admin.js).
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { dbService, authenticateToken, validate, id, isSelfOrAdmin } from '../shared.js';
import { broadcastVerificationChanged } from '../realtime.js';

const router = Router();

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

// Multipart form fields arrive as strings. Address and phone are only optional on resubmit.
const verificationSchema = z.object({
  userId: id,
  businessAddress: z.string().trim().max(500).optional(),
  businessPhone: z.string().trim().max(50).optional(),
});

const upload = [authenticateToken, uploadVerifDoc.single('document'), validate(verificationSchema)];

// Submit verification document (user, called right after registration)
router.post('/api/verification/submit', ...upload, async (req, res) => {
  try {
    const { userId, businessAddress, businessPhone } = req.body;
    if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });
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

router.get('/api/verification/status/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });
  try {
    res.json((await dbService.getVerification(userId)) || { status: 'none' });
  } catch (error) {
    logger.error('Verification status error', { error: error.message });
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// Re-upload document after rejection (or first submit if no record yet — legacy users)
router.post('/api/verification/resubmit', ...upload, async (req, res) => {
  try {
    const { userId, businessAddress, businessPhone } = req.body;
    if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });
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

export default router;
