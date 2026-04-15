import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import pool from './db';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import likesRoutes from './routes/likes';
import commentsRoutes from './routes/comments';
import fridgeRoutes from './routes/fridge';
import followsRoutes from './routes/follows';
import notificationsRoutes from './routes/notifications';
import usersRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import moneyPrinterRoutes from './routes/moneyPrinter';
import feedPreviewRoutes from './routes/feedPreview';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use(compression());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT p.id, u.username, p.scope, p.caption FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC LIMIT 10');
    res.json({ status: 'ok', version: 'v20260324-2105', time: new Date().toISOString(), recent_posts: rows });
  } catch (err: any) {
    res.json({ status: 'error', error: err.message });
  }
});

app.use('/auth', authRoutes);
app.use(feedPreviewRoutes);
app.use('/mp', moneyPrinterRoutes);
app.use('/posts', postsRoutes);
app.use('/posts', likesRoutes);
app.use('/posts', commentsRoutes);
app.use('/posts', fridgeRoutes);
app.use('/users', usersRoutes);
app.use('/users', followsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin', adminRoutes);

async function applyIndexes() {
  try {
    const queries = [
      'CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id)',
      'CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)',
      'CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)',
      'CREATE INDEX IF NOT EXISTS idx_fridge_saves_user_id ON fridge_saves(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_scope_reported ON posts(scope, is_reported)'
    ];
    for (const q of queries) await pool.query(q);
    console.log('[DB] Indexes verified successfully.');
  } catch (err) {
    console.error('[DB] Failed to apply indexes', err);
  }
}
// Run non-blocking after 5 seconds to avoid startup crash loops
setTimeout(applyIndexes, 5000);

app.listen(PORT, () => {
  console.log(`8wut API running on port ${PORT}`);
});

export default app;
