import pool from '../db';

async function migrate() {
  console.log('Starting migration: adding bio_color to users table...');
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_color TEXT DEFAULT 'orange'");
    console.log('Migration successful: bio_color column added.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
