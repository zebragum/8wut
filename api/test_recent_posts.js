const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://zadmin:HwTf4M65XhK3mR2c@dpg-cva3hl0u0jmec73qijc0-a.oregon-postgres.render.com/eightwut_db8v',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const { rows } = await client.query("SELECT id, caption, scope, created_at FROM posts ORDER BY created_at DESC LIMIT 5");
    console.log("Recent posts:", rows);

    for (let r of rows) {
      console.log("Testing post ID:", r.id);
      try {
        const res = await client.query(`
          SELECT
           p.id, p.caption, p.scope,
           (SELECT json_agg(json_build_object('url', pi.url, 'sort_order', pi.sort_order) ORDER BY pi.sort_order)
            FROM post_images pi WHERE pi.post_id = p.id) AS images
         FROM posts p
         WHERE p.id = $1
        `, [r.id]);
        console.log("  -> OK:", res.rows[0]);
      } catch (err) {
        console.error("  -> ERROR:", err.message);
      }
    }
  } catch(e) {
    console.error("DB Main Error:", e.message);
  } finally {
    await client.end();
  }
}

run();
