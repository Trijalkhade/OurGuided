const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const jwt     = require('jsonwebtoken');

// ── helper: run the reinforcement algorithm for a completed session ─────────
function computeKnowledge(hours, stats) {
    let { multiplier, learning_core } = stats;
    const hourly_compound_rate = 0.005;
    let knowledge = 0;
    const full_hours = Math.floor(hours);
    for (let h = 0; h < full_hours; h++) {
        knowledge += multiplier;
        multiplier += multiplier * hourly_compound_rate * learning_core * 0.7;
    }
    const remaining = hours - full_hours;
    if (remaining > 0) {
        knowledge += remaining * multiplier;
        multiplier += multiplier * hourly_compound_rate * learning_core * remaining;
    }
    return { knowledge, multiplier };
}

// ── ensure a study_streak row exists ────────────────────────────────────────
async function ensureStreak(conn, userId) {
    const [rows] = await conn.execute('SELECT * FROM study_streak WHERE user_id = ?', [userId]);
    if (!rows.length) {
        await conn.execute('INSERT INTO study_streak (user_id) VALUES (?)', [userId]);
        return { user_id: userId, multiplier: 1.0, learning_core: 1.0, streak_days: 0, streak_factor: 0, total_knowledge: 0.0, last_study_date: null };
    }
    return rows[0];
}

// ── shared stop logic ────────────────────────────────────────────────────────
async function doStop(userId, res) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [sessions] = await conn.execute(
            'SELECT * FROM study_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
            [userId]
        );
        if (!sessions.length) {
            await conn.rollback();
            return res ? res.status(400).json({ message: 'No active session' }) : null;
        }
        const session = sessions[0];

        // Real elapsed time from DB timestamps — no fake values
        const [elapsed] = await conn.execute(
            'SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS secs', [session.start_time]
        );
        const hours = Math.max(elapsed[0].secs / 3600, 0);

        const stats = await ensureStreak(conn, userId);
        let { multiplier, learning_core, streak_days, streak_factor, total_knowledge, last_study_date } = stats;
        multiplier       = parseFloat(multiplier);
        learning_core    = parseFloat(learning_core);
        total_knowledge  = parseFloat(total_knowledge);

        const min_multiplier = 0.5;
        const core_growth    = 0.05;
        const today    = new Date().toISOString().slice(0, 10);
        const lastDate = last_study_date ? new Date(last_study_date).toISOString().slice(0, 10) : null;
        const isNewDay = lastDate !== today;
        let streakBroken = false;
        let coreEvolved  = false;

        if (hours > 0) {
            if (isNewDay) {
                if (lastDate) {
                    const diffDays = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
                    if (diffDays > 1) {
                        streakBroken = true;
                        streak_factor = Math.floor(streak_factor / 10);
                        multiplier    = Math.max(multiplier - core_growth * learning_core, min_multiplier);
                        learning_core = Math.max(learning_core - core_growth / 2, 1.0);
                    }
                }
                streak_days  += 1;
                streak_factor += 1;
            }

            const { knowledge, multiplier: newMult } = computeKnowledge(hours, { multiplier, learning_core });
            multiplier       = newMult;
            total_knowledge += knowledge;

            if (streak_factor > 0 && streak_factor % 30 === 0) {
                learning_core += core_growth;
                coreEvolved    = true;
            }

            await conn.execute(
                'UPDATE study_sessions SET end_time = NOW(), knowledge_gained = ? WHERE session_id = ?',
                [knowledge.toFixed(4), session.session_id]
            );

            await conn.execute(
                `INSERT INTO study_streak (user_id, multiplier, learning_core, streak_days, streak_factor, total_knowledge, last_study_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   multiplier = VALUES(multiplier), learning_core = VALUES(learning_core),
                   streak_days = VALUES(streak_days), streak_factor = VALUES(streak_factor),
                   total_knowledge = VALUES(total_knowledge), last_study_date = VALUES(last_study_date)`,
                [userId, multiplier.toFixed(4), learning_core.toFixed(4),
                 streak_days, streak_factor, total_knowledge.toFixed(4), today]
            );

            await conn.execute(
                'UPDATE user_profile SET total_knowledge = ?, core_level = ? WHERE user_id = ?',
                [total_knowledge.toFixed(4), learning_core.toFixed(4), userId]
            );

            await conn.commit();

            if (res) {
                res.json({
                    session_id: session.session_id,
                    hours_studied: parseFloat(hours.toFixed(4)),
                    knowledge_gained: parseFloat(knowledge.toFixed(4)),
                    multiplier: parseFloat(multiplier.toFixed(3)),
                    learning_core: parseFloat(learning_core.toFixed(3)),
                    streak_days, streak_factor,
                    total_knowledge: parseFloat(total_knowledge.toFixed(4)),
                    core_evolved: coreEvolved,
                    streak_broken: streakBroken,
                });
            }
        } else {
            // Less than 1 second — close silently
            await conn.execute(
                'UPDATE study_sessions SET end_time = NOW(), knowledge_gained = 0 WHERE session_id = ?',
                [session.session_id]
            );
            await conn.commit();
            if (res) res.json({ session_id: session.session_id, hours_studied: 0, knowledge_gained: 0 });
        }
    } catch (err) {
        await conn.rollback();
        console.error('STOP ERROR:', err);
        if (res) res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
}

// ── POST /api/study/start ────────────────────────────────────────────────────
router.post('/start', auth, async (req, res) => {
    const userId = req.user.user_id;
    const conn   = await db.getConnection();
    try {
        // Close any orphaned open sessions first
        await conn.execute(
            `UPDATE study_sessions SET end_time = NOW(), knowledge_gained = 0
             WHERE user_id = ? AND end_time IS NULL`,
            [userId]
        );
        const [result] = await conn.execute(
            'INSERT INTO study_sessions (user_id, start_time, session_date) VALUES (?, NOW(), CURDATE())',
            [userId]
        );
        res.status(201).json({ session_id: result.insertId, status: 'started' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ── POST /api/study/stop ─────────────────────────────────────────────────────
// Supports both normal JSON requests and sendBeacon (application/json blob)
router.post('/stop', async (req, res) => {
    // sendBeacon sends the token in headers just like normal; auth middleware still works
    // But we need to handle bearer auth manually here because auth middleware runs before us
    const authHeader = req.headers['authorization'] || '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ message: 'No token' });

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        userId = decoded.user_id;
    } catch {
        return res.status(401).json({ message: 'Invalid token' });
    }

    await doStop(userId, res);
});

// ── GET /api/study/status ────────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
    const userId = req.user.user_id;
    try {
        const [active] = await db.execute(
            'SELECT session_id, start_time FROM study_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
            [userId]
        );
        const [streak] = await db.execute('SELECT * FROM study_streak WHERE user_id = ?', [userId]);
        const [todayRows] = await db.execute(
            `SELECT COALESCE(SUM(hours_studied), 0) AS today_hours,
                    COALESCE(SUM(knowledge_gained), 0) AS today_knowledge
             FROM study_sessions
             WHERE user_id = ? AND session_date = CURDATE() AND end_time IS NOT NULL`,
            [userId]
        );
        res.json({
            active_session: active[0] || null,
            stats: streak[0] || {
                multiplier: 1.0, learning_core: 1.0, streak_days: 0,
                streak_factor: 0, total_knowledge: 0, last_study_date: null,
            },
            today: {
                hours:     parseFloat((todayRows[0].today_hours     || 0).toFixed(2)),
                knowledge: parseFloat((todayRows[0].today_knowledge || 0).toFixed(2)),
            },
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/study/history ───────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
    const userId = req.user.user_id;
    try {
        const [rows] = await db.execute(
            `SELECT session_date,
                    COUNT(*) AS session_count,
                    SUM(hours_studied) AS total_hours,
                    SUM(knowledge_gained) AS total_knowledge
             FROM study_sessions
             WHERE user_id = ? AND end_time IS NOT NULL
             GROUP BY session_date
             ORDER BY session_date DESC
             LIMIT 30`,
            [userId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/study/sessions ──────────────────────────────────────────────────
router.get('/sessions', auth, async (req, res) => {
    const userId = req.user.user_id;
    try {
        const [rows] = await db.execute(
            `SELECT session_id, start_time, end_time, hours_studied, knowledge_gained, session_date
             FROM study_sessions
             WHERE user_id = ? AND end_time IS NOT NULL
             ORDER BY start_time DESC
             LIMIT 20`,
            [userId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;