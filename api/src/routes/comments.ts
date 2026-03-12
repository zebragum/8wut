import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';

const router = Router();

// GET /posts/:id/comments
router.get('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.created_at, c.is_hearted,
              u.id AS author_id, u.username, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(rows.map(r => ({
      id: r.id,
      text: r.text,
      isHearted: r.is_hearted,
      timestamp: r.created_at,
      author: { id: r.author_id, username: r.username, avatarUrl: r.avatar_url }
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /posts/:id/comments
router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  try {
    const { rows: [comment] } = await pool.query(
      `INSERT INTO comments (post_id, author_id, text) VALUES ($1, $2, $3)
       RETURNING id, text, created_at`,
      [req.params.id, req.userId, text.trim()]
    );
    const { rows: [user] } = await pool.query(
      'SELECT id, username, avatar_url FROM users WHERE id = $1', [req.userId]
    );
    // Notify post author
    const { rows: [post] } = await pool.query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (post && post.author_id !== req.userId) {
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, 'comment', $3)`,
        [post.author_id, req.userId, req.params.id]
      );
      // PUSH
      await sendPushNotification(post.author_id, {
        title: '8wut',
        body: `${user.username} commented on wut u 8`,
        icon: '/icon-192.png',
        data: { url: `/post/${req.params.id}` }
      });
    }
    res.status(201).json({
      id: comment.id,
      text: comment.text,
      timestamp: comment.created_at,
      author: { id: user.id, username: user.username, avatarUrl: user.avatar_url }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /posts/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND author_id = $2',
      [req.params.commentId, req.userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Comment not found or not yours' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /posts/:postId/comments/:commentId/heart
router.patch('/:postId/comments/:commentId/heart', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Only post author can heart comments
    const { rows: [post] } = await pool.query('SELECT author_id FROM posts WHERE id = $1', [req.params.postId]);
    if (!post || post.author_id !== req.userId) {
      res.status(403).json({ error: 'Only the post author can heart comments' });
      return;
    }
    const { rows: [comment] } = await pool.query(
      'UPDATE comments SET is_hearted = NOT is_hearted WHERE id = $1 AND post_id = $2 RETURNING is_hearted',
      [req.params.commentId, req.params.postId]
    );
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    res.json({ isHearted: comment.is_hearted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
