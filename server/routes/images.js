// Post images: the browser sends a compressed image, it goes into Supabase Storage,
// and the post keeps only the returned public URL.
import { Router } from 'express';
import multer from 'multer';
import { logger } from '../../src/utils/logger.ts';
import { dbService, authenticateToken } from '../shared.js';

const router = Router();

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB; compressed post images are ~100–300 KB
  fileFilter: (_req, file, cb) => {
    if (['image/webp', 'image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only WebP, JPG or PNG images are accepted'));
  },
});

// A wrong file type or an oversized file is the sender's mistake: answer 400, not a server error.
const acceptImage = (req, res, next) =>
  uploadImage.single('image')(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next()));

router.post('/api/images', authenticateToken, acceptImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const url = await dbService.uploadPostImage(req.user.userId, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (error) {
    logger.error('Post image upload failed', { error: error.message });
    res.status(500).json({ error: 'Could not store the image' });
  }
});

export default router;
