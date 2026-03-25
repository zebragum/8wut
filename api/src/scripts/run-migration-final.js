import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

try {
  const token = jwt.sign(
    { userId: 'system', isAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  console.log('Token generated! Hitting the production Render endpoint...');
  
  const res = await fetch('https://8wut.onrender.com/api/auth/migrate-reports', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await res.json();
  console.log('Response:', data);
  if (data.success) {
    console.log('✅ Remote database updated securely.');
  }
} catch (e) {
  console.error(e);
}
