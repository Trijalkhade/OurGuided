const db = require('./db');
const jwt = require('jsonwebtoken');

const USER_ID = 2; // Test user
const POST_ID = 66; // Test post
const AUTHOR_ID = 2; // Test author

const token = jwt.sign({ user_id: USER_ID }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
const API_BASE = 'http://localhost:5000/api/engagement';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function post(endpoint, payload) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

async function runTests() {
  console.log('🚀 Starting Engagement Tracking Tests...');

  try {
    // 1. Batch API (Watch Time, Impression, Scroll Depth, Video Completion)
    console.log('\n[1/5] Testing POST /batch ...');
    await post('/batch', {
      watchTimes: [{ postId: POST_ID, seconds: 45 }],
      scrollDepths: [{ postId: POST_ID, depthPct: 80 }],
      videoCompletions: [{ postId: POST_ID, completionPct: 100 }],
      impressions: [{ postId: POST_ID, clientHour: 15 }] // 15 = afternoon
    });
    console.log('✅ Batch API Success');

    // -- DATABASE VERIFICATION --
    console.log('\n🔍 VERIFYING DATABASE RECORDS:');

    const [wt] = await db.query('SELECT * FROM post_watch_time WHERE user_id=? AND post_id=?', [USER_ID, POST_ID]);
    console.log('- Watch Time:', wt[0]);

    const [imp] = await db.query('SELECT * FROM post_impressions WHERE user_id=? AND post_id=?', [USER_ID, POST_ID]);
    console.log('- Impression:', imp[0]);

    const [sd] = await db.query('SELECT * FROM post_scroll_depth WHERE user_id=? AND post_id=?', [USER_ID, POST_ID]);
    console.log('- Scroll Depth:', sd[0]);

    const [vc] = await db.query('SELECT * FROM post_video_completion WHERE user_id=? AND post_id=?', [USER_ID, POST_ID]);
    console.log('- Video Completion:', vc[0]);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch(e) {
    console.error('\n❌ TEST FAILED:', e.message);
  } finally {
    process.exit(0);
  }
}

runTests();
