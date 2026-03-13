import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT p.id, u.username, p.scope, p.caption FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC LIMIT 10');
    res.json({ status: 'ok', time: new Date().toISOString(), recent_posts: rows });
  } catch (err: any) {
    res.json({ status: 'error', error: err.message });
  }
});

app.use('/auth', authRoutes);
app.use('/posts', postsRoutes);
app.use('/posts', likesRoutes);
app.use('/posts', commentsRoutes);
app.use('/posts', fridgeRoutes);
app.use('/users', usersRoutes);
app.use('/users', followsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin', adminRoutes);

pool.query(`
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_hearted BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_used TEXT;
  UPDATE posts SET scope = 'private' WHERE scope = 'friends';
`)
  .then(() => console.log('Live PostgreSQL migrations complete'))
  .catch((err) => console.error('Migration failed:', err));

app.listen(PORT, () => {
  console.log(`8wut API running on port ${PORT}`);
});

export default app;
