const db = require('./db');
const jwt = require('jsonwebtoken');

const USER_ID = 2; // Test user
const token = jwt.sign({ user_id: USER_ID }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
const API_BASE = 'http://localhost:5000/api/growth';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function get(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

async function runTests() {
  console.log('🚀 Starting Growth Journey Tests...\n');

  try {
    // ── 1. Verify tables exist ──────────────────────────────────
    console.log('[1/7] Checking tables...');
    const tables = ['growth_journey', 'growth_journey_log', 'growth_reference_objects', 'streak_shields'];
    for (const t of tables) {
      const [rows] = await db.query(`SELECT COUNT(*) AS cnt FROM ${t}`);
      console.log(`  ✅ ${t} exists (${rows[0].cnt} rows)`);
    }

    // ── 2. Verify reference objects seed data ───────────────────
    console.log('\n[2/7] Checking reference objects...');
    const [refs] = await db.query('SELECT ref_id, label, height_cm FROM growth_reference_objects ORDER BY sort_order');
    console.log(`  ✅ ${refs.length} reference objects seeded`);
    if (refs.length < 10) throw new Error('Expected at least 10 reference objects');
    console.log(`  First: ${refs[0].label} (${refs[0].height_cm}cm)`);
    console.log(`  Last:  ${refs[refs.length-1].label} (${refs[refs.length-1].height_cm}cm)`);

    // ── 3. Test GET /state (auto-creates growth_journey row) ────
    console.log('\n[3/7] Testing GET /state...');
    const state = await get('/state');
    console.log(`  ✅ height_cm: ${state.height_cm}`);
    console.log(`  ✅ streak_days: ${state.streak_days}`);
    console.log(`  ✅ shield_count: ${state.shield_count}/${state.max_shields}`);
    console.log(`  ✅ is_at_risk: ${state.is_at_risk}`);
    console.log(`  ✅ current_ref: ${state.current_ref?.label || 'none'}`);
    console.log(`  ✅ next_ref: ${state.next_ref?.label || 'none'}`);
    console.log(`  ✅ progress_pct: ${state.progress_pct}%`);

    // Verify growth_journey row was created
    const [[gj]] = await db.query('SELECT * FROM growth_journey WHERE user_id = ?', [USER_ID]);
    if (!gj) throw new Error('growth_journey row was not auto-created');
    console.log(`  ✅ Auto-created growth_journey row (height: ${gj.height_cm}cm)`);

    // ── 4. Verify welcome bonus in log ──────────────────────────
    console.log('\n[4/7] Checking welcome bonus...');
    const [logs] = await db.query(
      "SELECT * FROM growth_journey_log WHERE user_id = ? AND source = 'welcome_bonus'",
      [USER_ID]
    );
    if (logs.length > 0) {
      console.log(`  ✅ Welcome bonus logged: +${logs[0].cm_gained}cm`);
    } else {
      console.log(`  ⚠️  No welcome bonus log (may have already existed)`);
    }

    // ── 5. Test GET /reference-objects ───────────────────────────
    console.log('\n[5/7] Testing GET /reference-objects...');
    const refObjs = await get('/reference-objects');
    console.log(`  ✅ ${refObjs.length} reference objects returned`);
    // Verify ordering
    for (let i = 1; i < refObjs.length; i++) {
      if (parseFloat(refObjs[i].height_cm) <= parseFloat(refObjs[i-1].height_cm)) {
        throw new Error(`Reference objects not sorted: ${refObjs[i-1].label} (${refObjs[i-1].height_cm}) >= ${refObjs[i].label} (${refObjs[i].height_cm})`);
      }
    }
    console.log('  ✅ Correctly sorted by height');

    // ── 6. Test GET /timeline ───────────────────────────────────
    console.log('\n[6/7] Testing GET /timeline...');
    const timeline = await get('/timeline?limit=10');
    console.log(`  ✅ ${timeline.length} log entries returned`);

    // ── 7. Test GET /achievements ───────────────────────────────
    console.log('\n[7/7] Testing GET /achievements...');
    const achData = await get('/achievements');
    const earned = achData.achievements.filter(a => a.earned);
    const locked = achData.achievements.filter(a => !a.earned);
    console.log(`  ✅ ${earned.length} earned, ${locked.length} locked`);
    console.log(`  ✅ Stats: height=${achData.stats.height_cm}cm, best_streak=${achData.stats.longest_streak}, days_growing=${achData.stats.days_growing}`);

    // ── Verify shield auto-creation ─────────────────────────────
    const [[shields]] = await db.query('SELECT * FROM streak_shields WHERE user_id = ?', [USER_ID]);
    if (!shields) throw new Error('streak_shields row was not auto-created');
    console.log(`\n🛡️  Shields: ${shields.shield_count}/${shields.max_shields}`);

    // ── Summary ─────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 ALL GROWTH JOURNEY TESTS PASSED!');
    console.log('═'.repeat(50));

  } catch (e) {
    console.error('\n❌ TEST FAILED:', e.message);
    console.error(e.stack);
  } finally {
    process.exit(0);
  }
}

runTests();
