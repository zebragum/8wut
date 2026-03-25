import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: './api/.env' });

const token = jwt.sign(
  { userId: 'system', isAdmin: true },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Token generated. Triggering remote migration...');

fetch('https://8wut.onrender.com/api/auth/migrate-reports', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})
  .then(r => r.json())
  .then(data => {
    console.log('Migration Response:', data);
    if (data.success) {
      console.log('✅ Remote DB successfully migrated. Feed restored.');
    }
  })
  .catch(console.error);
