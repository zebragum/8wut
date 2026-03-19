const axios = require('axios');

async function testProfiles() {
  try {
    const rnd = Math.random().toString(36).substring(7);
    console.log("Registering as test_user_" + rnd + " using 8WUT-DEBUG...");
    const res = await axios.post('https://eightwut-api.onrender.com/auth/register', {
      username: 'test_user_' + rnd,
      password: 'password',
      inviteCode: '8WUT-DEBUG'
    });
    console.log("Registered. Token received.");
    const token = res.data.token;
    
    // We retrieved zebragum's user id earlier: 0c324707-e815-472e-8550-ca511475752c
    const uid = '0c324707-e815-472e-8550-ca511475752c';
    
    console.log("\nFetching /users/" + uid);
    try {
      const u = await axios.get('https://eightwut-api.onrender.com/users/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> User OK', u.data.username);
    } catch(e) { console.log('-> User ERR', e.response?.data || e.message); }

    console.log("\nFetching /posts/user/" + uid);
    try {
      const p = await axios.get('https://eightwut-api.onrender.com/posts/user/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> Posts OK | Count:', p.data.length);
    } catch(e) { console.log('-> Posts ERR', e.response?.data || e.message); }

    console.log("\nFetching /posts/fridge/" + uid);
    try {
      const f = await axios.get('https://eightwut-api.onrender.com/posts/fridge/' + uid, {headers:{Authorization:'Bearer '+token}});
      console.log('-> Fridge OK | Count:', f.data.length);
    } catch(e) { console.log('-> Fridge ERR', e.response?.data || e.message); }

  } catch (err) {
    console.error('Registration failed:', err.response?.status, err.response?.data || err.message);
  }
}

testProfiles();
