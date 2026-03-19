const axios = require('axios');

async function testZebragum() {
  try {
    console.log("Fetching zebragum token...");
    const res = await axios.get('https://eightwut-api.onrender.com/auth/debug-zebragum');
    console.log("Got token.");
    const token = res.data.token;
    
    // zebragum id
    const uid = '449dad42-9364-4e0b-9078-d19777d4186c';
    
    console.log("\nFetching /users/" + uid);
    try {
      const u = await axios.get('https://eightwut-api.onrender.com/users/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> User OK', u.data.username);
    } catch(e) { console.log('-> User ERR', e.response?.data || e.message); }

    console.log("\nFetching /posts/user/" + uid);
    try {
      const p = await axios.get('https://eightwut-api.onrender.com/posts/user/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> Posts OK | Count:', p.data.length);
      // Wait, let's look at the first post returned just in case
      if (p.data.length > 0) {
          console.log("First post scope:", p.data[0].scope, "ID:", p.data[0].id);
      }
    } catch(e) { console.log('-> Posts ERR', e.response?.data || e.message); }

    console.log("\nFetching /posts/fridge/" + uid);
    try {
      const f = await axios.get('https://eightwut-api.onrender.com/posts/fridge/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> Fridge OK | Count:', f.data.length);
    } catch(e) { console.log('-> Fridge ERR', e.response?.data || e.message); }

  } catch (err) {
    if (err.response?.status === 404) {
      console.error('API not deployed yet, waiting...');
    } else {
      console.error('Test failed:', err.response?.status, err.response?.data || err.message);
    }
  }
}

testZebragum();
