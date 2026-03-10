import 'dotenv/config';
import pool from '../db';

async function main() {
  console.log('Adding scope column to posts table...');
  try {
    await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'everyone'");
    console.log('✅ Column added successfully!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
