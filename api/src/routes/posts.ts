import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';

const router = Router();

// Helper to fetch a post with all enriched data for a given user
async function fetchPost(postId: string, viewerId: string) {
  const { rows: [post] } = await pool.query(
      `SELECT
       p.id, p.caption, p.text_background, p.scope, p.created_at,
       u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
       EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = p.author_id) AS is_following,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS has_liked,
       EXISTS(SELECT 1 FROM fridge_saves WHERE post_id = p.id AND user_id = $2) AS saved_to_fridge,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
       (SELECT json_agg(
          json_build_object(
            'id', hc.id,
            'text', hc.text,
            'created_at', hc.created_at,
            'author', json_build_object('id', u2.id, 'username', u2.username, 'avatarUrl', u2.avatar_url)
          ) ORDER BY hc.created_at ASC
        ) FROM comments hc JOIN users u2 ON u2.id = hc.author_id WHERE hc.post_id = p.id AND hc.is_hearted = TRUE) AS hearted_comments,
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
    heartedComments: post.hearted_comments || [],
    _isFollowing: post.is_following // Internal use for permission checks
  };
}

// Bulk payload optimized version to prevent N+1 query latency
async function fetchPosts(postIds: string[], viewerId: string) {
  if (!postIds || postIds.length === 0) return [];
  const { rows } = await pool.query(
      `SELECT
       p.id, p.caption, p.text_background, p.scope, p.created_at,
       u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
       EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = p.author_id) AS is_following,
       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS has_liked,
       EXISTS(SELECT 1 FROM fridge_saves WHERE post_id = p.id AND user_id = $2) AS saved_to_fridge,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
       (SELECT json_agg(
          json_build_object(
            'id', hc.id,
            'text', hc.text,
            'created_at', hc.created_at,
            'author', json_build_object('id', u2.id, 'username', u2.username, 'avatarUrl', u2.avatar_url)
          ) ORDER BY hc.created_at ASC
        ) FROM comments hc JOIN users u2 ON u2.id = hc.author_id WHERE hc.post_id = p.id AND hc.is_hearted = TRUE) AS hearted_comments,
       (SELECT json_agg(json_build_object('url', pi.url, 'sort_order', pi.sort_order) ORDER BY pi.sort_order)
        FROM post_images pi WHERE pi.post_id = p.id) AS images
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.id = ANY($1::uuid[])`,
    [postIds, viewerId]
  );
  
  const postMap = new Map();
  for (const post of rows) {
    postMap.set(post.id, {
      ...post,
      author: { id: post.author_id, username: post.author_username, avatarUrl: post.author_avatar },
      images: (post.images || []).map((i: { url: string }) => i.url),
      likes: parseInt(post.likes_count),
      hasLiked: post.has_liked,
      savedToFridge: post.saved_to_fridge,
      commentsCount: parseInt(post.comments_count),
      heartedComments: post.hearted_comments || [],
      _isFollowing: post.is_following
    });
  }
  
  // Return in original requested order
  return postIds.map(id => postMap.get(id)).filter(Boolean);
}

// GET /posts/feed - posts from people you follow
router.get('/feed', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id FROM posts p
       WHERE p.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       AND p.scope != 'private' AND p.is_reported = FALSE
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    const posts = await fetchPosts(rows.map(r => r.id), req.userId!);
    res.json(posts);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /posts/debug
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, author_id, scope, created_at, caption FROM posts ORDER BY created_at DESC LIMIT 10');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /posts/discovery - all posts from everyone (discovery/home)
router.get('/discovery', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const { rows } = await pool.query(
      `SELECT id FROM posts WHERE scope = 'everyone' AND is_reported = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    );
    const posts = await fetchPosts(rows.map(r => r.id), req.userId!);
    res.json(posts);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /posts/search?q=query
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const query = req.query.q as string;
  if (!query || !query.trim()) {
    res.json([]);
    return;
  }
  
  const keywords = query.trim().split(/\s+/).filter(Boolean);
  const conditions: string[] = [];
  const params: string[] = [];

  keywords.forEach((word, i) => {
    conditions.push(`(p.caption ILIKE $${i + 1} OR u.username ILIKE $${i + 1})`);
    params.push(`%${word}%`);
  });

  try {
    const { rows } = await pool.query(
      `SELECT p.id FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.scope = 'everyone' AND p.is_reported = FALSE 
       AND (${conditions.join(' AND ')})
       ORDER BY p.created_at DESC 
       LIMIT 50`,
      params
    );
    const posts = await fetchPosts(rows.map(r => r.id), req.userId!);
    res.json(posts);
  } catch (err: any) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// GET /posts/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const post = await fetchPost(req.params.id as string, req.userId!);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  
  // No friend restriction block needed. If it's private, they just had to navigate to the profile to click it.  
  // Strip the internal tracking prop before sending
  const { _isFollowing, ...cleanPost } = post;
  res.json(cleanPost);
});

// POST /posts - create a post
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { caption, textBackground, images, scope, created_at } = req.body;
  console.log(`[POSTS] Creating post. Scope received: "${scope}"`);
  
  // Default to everyone, but if 'private' (or legacy 'friends') is sent, make it private.
  let postScope = 'everyone';
  if (scope === 'private' || scope === 'friends') {
    postScope = 'private';
  }
  console.log(`[POSTS] Final scope for DB: "${postScope}"`);

  if (!images?.length && !textBackground) {
    res.status(400).json({ error: 'Post must have images or a text background' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [post] } = await client.query(
      'INSERT INTO posts (author_id, caption, text_background, scope, created_at) VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP)) RETURNING id',
      [req.userId, caption || '', textBackground || null, postScope, created_at ? new Date(created_at).toISOString() : null]
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

    // Detect @mentions and send notifications
    if (caption) {
      const mentionedUsernames = [...new Set((caption.match(/@([A-Za-z0-9_-]+)/g) || []).map((m: string) => m.slice(1)))];
      for (const username of mentionedUsernames) {
        try {
          const { rows: [mentioned] } = await pool.query(
            'SELECT id FROM users WHERE lower(username) = lower($1)', [username]
          );
          if (mentioned && mentioned.id !== req.userId) {
            await pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, post_id)
               VALUES ($1, $2, 'mention', $3) ON CONFLICT DO NOTHING`,
              [mentioned.id, req.userId, post.id]
            );
            // PUSH
            const { rows: [actor] } = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
            sendPushNotification(mentioned.id, {
              title: '8wut',
              body: `${actor.username} @'d you in a post`,
              icon: '/icon-192.png',
              data: { url: `/post/${post.id}` }
            }).catch(e => console.error('Push error:', e));
          }
        } catch { /* non-critical — don't fail the post */ }
      }
    }

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
  const { caption, created_at, scope } = req.body;
  try {
    const { rows: [post] } = await pool.query(
      'UPDATE posts SET caption = $1, created_at = COALESCE($4, created_at), scope = COALESCE($5, scope) WHERE id = $2 AND author_id = $3 RETURNING id',
      [caption, req.params.id as string, req.userId, created_at ? new Date(created_at).toISOString() : null, scope || null]
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

// POST /posts/:id/report
router.post('/:id/report', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE posts SET is_reported = true WHERE id = $1',
      [req.params.id as string]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Post not found' });
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
    const posts = await fetchPosts(rows.map(r => r.id), req.userId!);
    
    // Every post by this user is visible on their profile page
    const visiblePosts = posts.map(p => {
      const { _isFollowing, ...cleanPost } = p!;
      return cleanPost;
    });

    res.json(visiblePosts);
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
    const posts = await fetchPosts(rows.map(r => r.id), req.userId!);
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
