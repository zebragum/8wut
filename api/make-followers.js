const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Find the user "blondebeauty"
    const res = await client.query("SELECT id, username FROM users WHERE username ILIKE '%blonde%' LIMIT 1");
    if (res.rows.length === 0) {
      console.log('User not found.');
      return;
    }
    const targetUserId = res.rows[0].id;
    console.log('Found user:', res.rows[0].username, targetUserId);

    // Get all other users
    const usersRes = await client.query("SELECT id FROM users WHERE id != $1", [targetUserId]);
    console.log(`Found ${usersRes.rows.length} other users.`);

    // Insert follow relationships
    let count = 0;
    for (const u of usersRes.rows) {
      try {
        await client.query(
          "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [u.id, targetUserId]
        );
        count++;
      } catch(e) { console.error(e); }
    }
    console.log(`Successfully made ${count} users follow ${res.rows[0].username}!`);
  } finally {
    client.release();
    pool.end();
  }
}
run();
