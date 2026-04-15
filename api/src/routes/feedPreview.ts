/**
 * Public read-only samples for MoneyPrinter (no JWT).
 * Mounted at '' so paths are /feed-preview (not under /posts — avoids /posts/:id auth).
 * Same opt-out as /mp: DISABLE_PUBLIC_POST_SAMPLE=1
 */
import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

function disabled(): boolean {
  return process.env.DISABLE_PUBLIC_POST_SAMPLE === '1';
}

const POST_SELECT = `
  SELECT p.id, p.caption, u.username AS author_username,
    (SELECT coalesce(json_agg(s.url ORDER BY s.sort_order), '[]'::json)
     FROM (
       SELECT pi.url, pi.sort_order FROM post_images pi WHERE pi.post_id = p.id
     ) s) AS images
  FROM posts p
  JOIN users u ON u.id = p.author_id
  WHERE p.scope = 'everyone' AND p.is_reported = FALSE
    AND EXISTS (SELECT 1 FROM post_images pi2 WHERE pi2.post_id = p.id)
`;

async function attachHandlePool(): Promise<string[]> {
  const { rows: poolRows } = await pool.query(
    `SELECT username FROM users
     WHERE username IS NOT NULL AND trim(username) <> ''
     ORDER BY random()
     LIMIT 60`
  );
  return poolRows.map((r: { username: string }) => r.username).filter(Boolean);
}

// GET /feed-preview — random public post with images (+ handle pool)
router.get('/feed-preview', async (_req: Request, res: Response) => {
  if (disabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const { rows: [post] } = await pool.query(`${POST_SELECT} ORDER BY random() LIMIT 1`);
    if (!post) {
      res.status(404).json({ error: 'No public image posts' });
      return;
    }
    const handlePool = await attachHandlePool();
    const images = Array.isArray(post.images) ? post.images : [];
    res.json({
      id: post.id,
      caption: post.caption || '',
      author: { username: post.author_username },
      images,
      handlePool
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /feed-preview/post/:postId
router.get('/feed-preview/post/:postId', async (req: Request, res: Response) => {
  if (disabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const postId = req.params.postId as string;
  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    res.status(400).json({ error: 'Invalid post id' });
    return;
  }
  try {
    const { rows: [post] } = await pool.query(
      `${POST_SELECT} AND p.id = $1::uuid`,
      [postId]
    );
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const handlePool = await attachHandlePool();
    const images = Array.isArray(post.images) ? post.images : [];
    res.json({
      id: post.id,
      caption: post.caption || '',
      author: { username: post.author_username },
      images,
      handlePool
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /feed-preview/:postId/comments
router.get('/feed-preview/:postId/comments', async (req: Request, res: Response) => {
  if (disabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const postId = req.params.postId as string;
  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    res.status(400).json({ error: 'Invalid post id' });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT text FROM comments WHERE post_id = $1::uuid ORDER BY created_at ASC LIMIT 80`,
      [postId]
    );
    res.json(rows.map((r: { text: string }) => r.text).filter((t: string) => t && t.trim()));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;
