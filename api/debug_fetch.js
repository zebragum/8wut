const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://zadmin:HwTf4M65XhK3mR2c@dpg-cva3hl0u0jmec73qijc0-a.oregon-postgres.render.com/eightwut_db8v',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Connecting...");
    const { rows } = await pool.query("SELECT id, scope, caption FROM posts WHERE scope='private' ORDER BY created_at DESC LIMIT 5");
    console.log("Found private posts:", rows);

    for (let r of rows) {
      console.log("Fetching post details for", r.id);
      const res = await pool.query(`
        SELECT
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
       WHERE p.id = $1
      `, [r.id, "0c324707-e815-472e-8550-ca511475752c"]);

      console.log("Result:", res.rows[0]);
    }

  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await pool.end();
  }
}

run();
