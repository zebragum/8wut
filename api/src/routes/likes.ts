import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /posts/:id/like
router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.id]
    );
    // Create notification if not own post
    const { rows: [post] } = await pool.query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (post && post.author_id !== req.userId) {
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, post_id)
         VALUES ($1, $2, 'liked wut u 8', $3) ON CONFLICT DO NOTHING`,
        [post.author_id, req.userId, req.params.id]
      );
    }
    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) FROM likes WHERE post_id = $1', [req.params.id]
    );
    res.json({ likes: parseInt(count), hasLiked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /posts/:id/like
router.delete('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.userId, req.params.id]);
    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) FROM likes WHERE post_id = $1', [req.params.id]
    );
    res.json({ likes: parseInt(count), hasLiked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
