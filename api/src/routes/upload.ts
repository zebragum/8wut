import { Router, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage so we can pipe to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed') as any);
  }
});

// POST /upload
router.post('/', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  console.log('Upload request received:', {
    hasFile: !!req.file,
    fileSize: req.file?.size,
    mimetype: req.file?.mimetype,
    userId: req.userId
  });

  if (!req.file) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: '8wut',
          transformation: [
            { width: 1080, height: 1080, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result as { secure_url: string });
          }
        }
      );
      (stream as any).end(req.file!.buffer);
    });
    console.log('Upload successful:', result.secure_url);
    res.json({ url: result.secure_url });
  } catch (err: any) {
    console.error('Upload route failed:', err);
    res.status(500).json({ error: 'Upload failed', details: err?.message || String(err) });
  }
});

export default router;
