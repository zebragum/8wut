import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';

const router = Router();

// GET /notifications
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         n.id, n.type, n.read, n.created_at,
         u.id AS actor_id, u.username AS actor_username, u.avatar_url AS actor_avatar,
         p.id AS post_id,
         (SELECT pi.url FROM post_images pi WHERE pi.post_id = n.post_id ORDER BY pi.sort_order LIMIT 1) AS post_image
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.userId]
    );

    // Mark all as read
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE recipient_id = $1 AND read = FALSE',
      [req.userId]
    );

    res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      read: r.read,
      timestamp: r.created_at,
      user: { id: r.actor_id, username: r.actor_username, avatarUrl: r.actor_avatar },
      postId: r.post_id || null,
      postImage: r.post_image
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read = FALSE',
      [req.userId]
    );
    res.json({ count: parseInt(count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /notifications/subscribe
router.post('/subscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscription required' });

    // Upsert subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, subscription) DO NOTHING`,
      [req.userId, JSON.stringify(subscription)]
    );

    // Send a confirmation push
    await sendPushNotification(req.userId || '', {
      title: 'Notifications Enabled!',
      body: 'You will now receive alerts for likes, comments, and follows.',
      icon: '/icon-192.png'
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /notifications/unsubscribe
router.post('/unsubscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription = $2',
      [req.userId, JSON.stringify(subscription)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
