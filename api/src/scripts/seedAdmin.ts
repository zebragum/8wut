/**
 * Creates the first admin user (Zach) with an initial invite code.
 * Run once after db:setup.
 * 
 * Usage: ADMIN_PASSWORD=yourpassword npm run db:seed-admin
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../db';

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('❌ Set ADMIN_PASSWORD env var first!');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  
  // Create Zach as admin
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (username, password_hash, is_admin, invite_code_used)
     VALUES ('Zach', $1, TRUE, 'FOUNDER') RETURNING id, username`,
    [hash]
  );
  console.log(`✅ Admin user created: ${user.username} (id: ${user.id})`);

  // Create initial batch of invite codes
  const codes = ['8WUT-A1', '8WUT-B2', '8WUT-C3', '8WUT-D4', '8WUT-E5',
                 '8WUT-F6', '8WUT-G7', '8WUT-H8', '8WUT-J9', '8WUT-K0'];
  for (const code of codes) {
    await pool.query(
      'INSERT INTO invite_codes (code, created_by, max_uses) VALUES ($1, $2, 1)',
      [code, user.id]
    );
  }
  console.log(`✅ Created ${codes.length} initial invite codes:`);
  codes.forEach(c => console.log(`   ${c}`));
  console.log('\n⚠️  Save these codes! Share them one-by-one with alpha users.');

  await pool.end();
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
