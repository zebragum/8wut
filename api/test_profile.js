const { Pool } = require('pg');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: 'postgres://zadmin:HwTf4M65XhK3mR2c@dpg-cva3hl0u0jmec73qijc0-a.oregon-postgres.render.com/eightwut_db8v',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const {rows} = await pool.query("SELECT id FROM users WHERE username='zebragum'");
    const uid = rows[0].id;
    
    // We don't know the exact Render JWT secret so we can only test the locally running API 
    // OR we can test the remote API if we happen to guess it's default based on .env
    const secret = "your-super-secret-key-change-this"; // from local .env.example
    const token = jwt.sign({ userId: uid }, secret);
    
    console.log("Locally testing API...");
    // Local API test
    try {
      const p1 = axios.get('http://localhost:3001/users/' + uid, { headers: { Authorization: 'Bearer ' + token } });
      const p2 = axios.get('http://localhost:3001/posts/user/' + uid, { headers: { Authorization: 'Bearer ' + token } });
      const p3 = axios.get('http://localhost:3001/posts/fridge/' + uid, { headers: { Authorization: 'Bearer ' + token } });
      
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      console.log("User status:", r1.status);
      console.log("Posts count:", r2.data.length);
      console.log("Fridge count:", r3.data.length);
      console.log("SUCCESS");
    } catch(e) {
      console.log("Local API ERR:", e.message, e.response?.data);
    }

  } catch (e) {
    console.error("DB ERR", e);
  } finally {
    await pool.end();
  }
}

run();
