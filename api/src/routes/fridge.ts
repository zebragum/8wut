import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /posts/:id/fridge - save to fridge
router.post('/:id/fridge', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'INSERT INTO fridge_saves (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.id]
    );
    // Notify post author
    const { rows: [post] } = await pool.query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (post && post.author_id !== req.userId) {
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, 'fridge', $3)`,
        [post.author_id, req.userId, req.params.id]
      );
    }
    res.json({ savedToFridge: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /posts/:id/fridge - remove from fridge
router.delete('/:id/fridge', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM fridge_saves WHERE user_id = $1 AND post_id = $2',
      [req.userId, req.params.id]
    );
    res.json({ savedToFridge: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
