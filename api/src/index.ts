import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

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

app.listen(PORT, () => {
  console.log(`8wut API running on port ${PORT}`);
});

export default app;
