import { Router, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import pool from '../db';
import { requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /admin/users - list all users
router.get('/users', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.is_admin, u.created_at, u.invite_code_used,
              (SELECT COUNT(*) FROM posts WHERE author_id = u.id) AS post_count
       FROM users u ORDER BY u.created_at ASC`
    );
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ users: rows, total: parseInt(count), maxUsers: 40 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/invites - list all invite codes
router.get('/invites', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ic.*, u.username AS created_by_username
       FROM invite_codes ic
       LEFT JOIN users u ON u.id = ic.created_by
       ORDER BY ic.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/invites - generate a new invite code
router.post('/invites', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { maxUses = 1 } = req.body;
  const code = randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F2BC1D"
  try {
    const { rows: [invite] } = await pool.query(
      'INSERT INTO invite_codes (code, created_by, max_uses) VALUES ($1, $2, $3) RETURNING *',
      [code, req.userId, maxUses]
    );
    res.status(201).json(invite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /admin/invites/:code - revoke an invite code
router.delete('/invites/:code', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM invite_codes WHERE code = $1', [req.params.code as string]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/users/:id/make-admin - promote user to admin
router.patch('/users/:id/make-admin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [req.params.id as string]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
