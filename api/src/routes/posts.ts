import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to fetch a post with all enriched data for a given user
async function fetchPost(postId: string, viewerId: string) {
  const { rows: [post] } = await pool.query(
      `SELECT
       p.id, p.caption, p.text_background, p.scope, p.created_at,
       u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS has_liked,
       EXISTS(SELECT 1 FROM fridge_saves WHERE post_id = p.id AND user_id = $2) AS saved_to_fridge,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
       (SELECT json_agg(json_build_object('url', pi.url, 'sort_order', pi.sort_order) ORDER BY pi.sort_order)
        FROM post_images pi WHERE pi.post_id = p.id) AS images
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.id = $1`,
    [postId, viewerId]
  );
  if (!post) return null;
  return {
    ...post,
    author: { id: post.author_id, username: post.author_username, avatarUrl: post.author_avatar },
    images: (post.images || []).map((i: { url: string }) => i.url),
    likes: parseInt(post.likes_count),
    hasLiked: post.has_liked,
    savedToFridge: post.saved_to_fridge,
    commentsCount: parseInt(post.comments_count),
  };
}

// GET /posts/feed - posts from people you follow + your own
router.get('/feed', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id FROM posts p
       WHERE p.author_id = $1
          OR p.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    const posts = await Promise.all(rows.map(r => fetchPost(r.id, req.userId!)));
    res.json(posts.filter(Boolean));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /posts/discovery - all posts from everyone (discovery/home)
router.get('/discovery', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM posts WHERE scope = 'everyone' ORDER BY created_at DESC LIMIT 50`
    );
    const posts = await Promise.all(rows.map(r => fetchPost(r.id, req.userId!)));
    res.json(posts.filter(Boolean));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /posts/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const post = await fetchPost(req.params.id as string, req.userId!);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.json(post);
});

// POST /posts - create a post
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { caption, textBackground, images, scope } = req.body;
  const postScope = scope === 'friends' ? 'friends' : 'everyone';

  if (!images?.length && !textBackground) {
    res.status(400).json({ error: 'Post must have images or a text background' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [post] } = await client.query(
      'INSERT INTO posts (author_id, caption, text_background, scope) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.userId, caption || '', textBackground || null, postScope]
    );
    if (images?.length) {
      for (let i = 0; i < images.length; i++) {
        await client.query(
          'INSERT INTO post_images (post_id, url, sort_order) VALUES ($1, $2, $3)',
          [post.id, images[i], i]
        );
      }
    }
    await client.query('COMMIT');
    const enriched = await fetchPost(post.id, req.userId!);
    res.status(201).json(enriched);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /posts/:id - edit caption
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { caption } = req.body;
  try {
    const { rows: [post] } = await pool.query(
      'UPDATE posts SET caption = $1 WHERE id = $2 AND author_id = $3 RETURNING id',
      [caption, req.params.id as string, req.userId]
    );
    if (!post) {
      res.status(404).json({ error: 'Post not found or not yours' });
      return;
    }
    const enriched = await fetchPost(post.id, req.userId!);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /posts/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND author_id = $2',
      [req.params.id as string, req.userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Post not found or not yours' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /posts/user/:userId - get all posts by a user
router.get('/user/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM posts WHERE author_id = $1 ORDER BY created_at DESC',
      [req.params.userId as string]
    );
    const posts = await Promise.all(rows.map(r => fetchPost(r.id, req.userId!)));
    res.json(posts.filter(Boolean));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /posts/fridge/:userId - get user's fridge saves
router.get('/fridge/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT fs.post_id AS id FROM fridge_saves fs
       WHERE fs.user_id = $1 ORDER BY fs.created_at DESC`,
      [req.params.userId as string]
    );
    const posts = await Promise.all(rows.map(r => fetchPost(r.id, req.userId!)));
    res.json(posts.filter(Boolean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
