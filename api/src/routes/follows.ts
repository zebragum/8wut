import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /users/:id/follow
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.userId === req.params.id) {
    res.status(400).json({ error: 'Cannot follow yourself' });
    return;
  }
  try {
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.id]
    );
    await pool.query(
      `INSERT INTO notifications (recipient_id, actor_id, type) VALUES ($1, $2, 'follow')`,
      [req.params.id, req.userId]
    );
    res.json({ isFollowing: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/:id/follow
router.delete('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.userId, req.params.id]
    );
    res.json({ isFollowing: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
