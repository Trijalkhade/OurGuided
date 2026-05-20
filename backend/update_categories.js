/**
 * One-time script to replace old categories with new ones in the database.
 * Run: node update_categories.js
 * Delete this file after running.
 */
const pool = require('./db');

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Current categories ---');
    const [current] = await conn.query('SELECT * FROM categories ORDER BY category_id');
    console.table(current);

    // Delete all old categories (CASCADE will clean up user_interests)
    await conn.query('DELETE FROM categories');
    console.log('✅ Deleted all old categories');

    // Insert new categories
    const newCats = [
      ['Real Talk',           '💬', 'Opinions, criticism, uncomfortable truths — said plainly'],
      ['Experiments & Ideas', '🧪', 'Unproven theories, personal experiments, what-if thinking'],
      ['Loopholes & Fixes',   '🔧', 'Spot what is broken in the system and propose real fixes'],
      ['Life Hacks',          '⚡', 'Practical skills that actually help you survive and thrive'],
      ['Youth & Education',   '🎒', 'What school should teach but never does'],
      ['Health & Body',       '🥗', 'Nutrition, fitness, and mental wellness — no pseudo-science'],
      ['Earth & Hands',       '🌱', 'Farming, sustainability, building things, making things'],
      ['Economy & Power',     '💡', 'Money, politics, corporations — who holds power and why'],
    ];

    for (const [name, icon, description] of newCats) {
      await conn.query(
        'INSERT INTO categories (name, icon, description) VALUES (?, ?, ?)',
        [name, icon, description]
      );
    }
    console.log(`✅ Inserted ${newCats.length} new categories`);

    // Verify
    const [updated] = await conn.query('SELECT * FROM categories ORDER BY category_id');
    console.log('\n--- Updated categories ---');
    console.table(updated);

    console.log('\n🎉 Done! Restart the server and rebuild frontend.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

main();
