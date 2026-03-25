import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 15000
});

async function run() {
  let success = false;
  console.log('Initiating direct connection to Render PostgreSQL (Bypassing stalled Render API Build)...');
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`Connection attempt ${i + 1}...`);
      const client = await pool.connect();
      console.log('Connected! Executing migration...');
      await client.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT FALSE;');
      console.log('✅ SUCCESS! The `is_reported` column was added. Feed is restored.');
      client.release();
      success = true;
      break;
    } catch (e) {
      console.error(`Attempt ${i + 1} failed:`, e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  process.exit(success ? 0 : 1);
}
run();
