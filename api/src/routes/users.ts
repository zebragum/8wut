import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /users/by-username/:username - resolve @mention to profile
router.get('/by-username/:username', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [user] } = await pool.query(
      'SELECT id, username, avatar_url, bio, created_at FROM users WHERE lower(username) = lower($1)',
      [req.params.username]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/search?q=...
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const query = req.query.q as string;
  if (!query || !query.trim()) {
    res.json([]);
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.bio,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM users u 
       WHERE u.username ILIKE $1 
       ORDER BY u.created_at DESC LIMIT 20`,
      [`%${query.trim()}%`, req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:id/followers
router.get('/:id/followers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.bio,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC LIMIT 100`,
      [req.params.id, req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:id/following
router.get('/:id/following', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.bio,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC LIMIT 100`,
      [req.params.id, req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// GET /users/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.id as string;
    const { rows: [user] } = await pool.query(
      `SELECT
         u.id, u.username, u.avatar_url, u.bio, u.bio_color, u.is_admin, u.created_at,
         (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
         (SELECT COUNT(*) FROM posts WHERE author_id = u.id) AS post_count,
         EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM users u
       WHERE u.id = $1`,
      [targetUserId, req.userId]
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      ...user,
      followersCount: parseInt(user.followers_count),
      followingCount: parseInt(user.following_count),
      postCount: parseInt(user.post_count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /users/me - update own profile
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { username, bio, avatarUrl, bioColor } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (username?.trim()) {
    // No spaces allowed in usernames
    if (/\s/.test(username.trim())) {
      res.status(400).json({ error: 'Username cannot contain spaces' });
      return;
    }
    // Check uniqueness
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM users WHERE lower(username) = lower($1) AND id != $2',
      [username.trim(), req.userId]
    );
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    updates.push(`username = $${idx++}`);
    values.push(username.trim());
  }
  if (bio !== undefined) { updates.push(`bio = $${idx++}`); values.push(bio); }
  if (avatarUrl?.trim()) { updates.push(`avatar_url = $${idx++}`); values.push(avatarUrl.trim()); }
  if (bioColor?.trim()) { updates.push(`bio_color = $${idx++}`); values.push(bioColor.trim()); }

  if (!updates.length) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  values.push(req.userId);

  try {
    const { rows: [user] } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, username, avatar_url, bio, bio_color, is_admin, created_at`,
      values
    );
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
