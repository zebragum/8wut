/**
 * Run this script once after setting up your Render PostgreSQL database.
 * It reads schema.sql and executes it to create all tables.
 * 
 * Usage: npm run db:setup
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../db';

async function main() {
  // schema.sql is in the root of 'api/' (two levels up from dist/scripts/)
  const sql = readFileSync(join(__dirname, '..', '..', 'schema.sql'), 'utf8');
  console.log('Running schema.sql...');
  await pool.query(sql);
  console.log('✅ Database schema created successfully!');
  await pool.end();
}

main().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
