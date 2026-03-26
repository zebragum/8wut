import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Beta: no user cap

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, inviteCode, website } = req.body;

  // Honeypot: bots fill this invisible field, humans never do
  if (website) {
    res.status(400).json({ error: 'Registration failed' });
    return;
  }

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  if (/\s/.test(username.trim())) {
    res.status(400).json({ error: 'Username cannot contain spaces' });
    return;
  }
  if (username.trim().length > 25) {
    res.status(400).json({ error: 'Username must be 25 characters or less' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check username taken
    const { rows: [existing] } = await client.query(
      'SELECT id FROM users WHERE lower(username) = lower($1)',
      [username.trim()]
    );
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    // Validate invite code if provided (optional for beta)
    const codeUsed = inviteCode?.trim().toUpperCase() || null;
    if (codeUsed) {
      const { rows: [invite] } = await client.query(
        'SELECT * FROM invite_codes WHERE code = $1 AND times_used < max_uses',
        [codeUsed]
      );
      if (!invite) {
        res.status(400).json({ error: 'Invalid or already-used invite code' });
        return;
      }
      // Mark invite used
      await client.query(
        'UPDATE invite_codes SET times_used = times_used + 1 WHERE code = $1',
        [codeUsed]
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (username, password_hash, invite_code_used)
       VALUES ($1, $2, $3) RETURNING id, username, avatar_url, bio, is_admin, created_at`,
      [username.trim(), passwordHash, codeUsed]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  try {
    const { rows: [user] } = await pool.query(
      'SELECT * FROM users WHERE lower(username) = lower($1)',
      [username.trim()]
    );
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    void password_hash;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT id, username, avatar_url, bio, is_admin, created_at,
        (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following_count,
        (SELECT COUNT(*) FROM posts WHERE author_id = users.id) AS post_count
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword?.trim() || !newPassword?.trim()) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/migrate-reports (Temporary)
router.get('/migrate-reports', async (req: Request, res: Response) => {
  try {
    await pool.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT FALSE');
    res.json({ success: true, message: 'Migration applied!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
