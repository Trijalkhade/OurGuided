const axios = require('axios');
const assert = require('assert');

async function test() {
  const api = axios.create({ baseURL: 'http://3.88.216.157:5000/api' });
  const rnd = Math.random().toString(36).substring(7);

  try {
    // Register User A
    const resA = await api.post('/auth/register', {
      username: 'usera_' + rnd, email: `a_${rnd}@ex.com`, password: 'pw', first_name: 'A', last_name: 'A'
    });
    const tokenA = resA.data.token;
    const userA = resA.data.user_id;

    // Register User B
    const resB = await api.post('/auth/register', {
      username: 'userb_' + rnd, email: `b_${rnd}@ex.com`, password: 'pw', first_name: 'B', last_name: 'B'
    });
    const tokenB = resB.data.token;
    const userB = resB.data.user_id;

    console.log('Registration OK');

    // Update Profile A
    await api.put('/users/profile/update', {
      bio: "Hello", dob: '1995-05-05' 
    }, { headers: { Authorization: `Bearer ${tokenA}` }});

    // Profile Get
    const profA = await api.get(`/users/${userA}`, { headers: { Authorization: `Bearer ${tokenA}` }});
    assert(profA.data.bio === 'Hello' && profA.data.age > 0, 'Profile check failed');

    console.log('Profile OK');

    // Posts A
    const postRes = await api.post('/posts', { content: 'My post text', tags: 'tag1, tag2' }, { headers: { Authorization: `Bearer ${tokenA}` }});
    const postId = postRes.data.post_id;
    
    // Feed B
    const feedB = await api.get('/posts/feed', { headers: { Authorization: `Bearer ${tokenB}` }});
    assert(feedB.data[0].content === 'My post text' && feedB.data[0].tags === 'tag1,tag2', 'Post check failed');

    console.log('Posts OK');

    // Connections A -> B
    await api.post(`/connections/request/${userB}`, {}, { headers: { Authorization: `Bearer ${tokenA}` }});
    
    // B checks status
    const statusB = await api.get(`/connections/status/${userA}`, { headers: { Authorization: `Bearer ${tokenB}` }});
    assert(statusB.data.status === 'pending_received', 'Status check 1 failed');
    
    // B accepts
    await api.post(`/connections/accept/${userA}`, {}, { headers: { Authorization: `Bearer ${tokenB}` }});
    
    // Status check
    const statusA = await api.get(`/connections/status/${userB}`, { headers: { Authorization: `Bearer ${tokenA}` }});
    assert(statusA.data.status === 'accepted', 'Status check 2 failed');

    console.log('Connections OK');
    
    console.log('ALL TESTS PASSED');
    process.exit(0);

  } catch(e) {
    if(e.response) console.error(e.response.data);
    else console.error(e);
    process.exit(1);
  }
}

test();
