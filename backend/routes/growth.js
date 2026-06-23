const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');

// ── Growth constants ─────────────────────────────────────────────────────────
const CM_PER_DAY = 10;
const MIN_SESSION_SECONDS = 120; // 2 minutes
const QUIZ_PASS_THRESHOLD = 70; // percentage
const WELCOME_BONUS_CM = 10;

// ── Cache reference objects in memory (rarely changes) ───────────────────────
let _refObjectsCache = null;
let _refCacheTime = 0;
const REF_CACHE_TTL = 600000; // 10 minutes

async function getRefObjects(conn) {
    const now = Date.now();
    if (_refObjectsCache && (now - _refCacheTime) < REF_CACHE_TTL) {
        return _refObjectsCache;
    }
    const queryFn = conn || db;
    const [rows] = await queryFn.query(
        'SELECT ref_id, label, height_cm, sort_order, asset_file FROM growth_reference_objects ORDER BY sort_order ASC'
    );
    _refObjectsCache = rows.map(r => ({
        ...r,
        height_cm: parseFloat(r.height_cm)
    }));
    _refCacheTime = now;
    return _refObjectsCache;
}

// ── Resolve current & next reference objects for a given height ──────────────
function resolveRefs(refObjects, heightCm) {
    let currentRef = null;
    let nextRef = null;

    for (let i = 0; i < refObjects.length; i++) {
        if (heightCm >= refObjects[i].height_cm) {
            currentRef = refObjects[i];
        } else {
            nextRef = refObjects[i];
            break;
        }
    }

    // If we've passed all objects, currentRef is the last one, nextRef is null
    if (!currentRef && refObjects.length > 0) {
        currentRef = null;
        nextRef = refObjects[0];
    }

    // Calculate progress percentage between current and next
    let progressPct = 0;
    if (currentRef && nextRef) {
        const range = nextRef.height_cm - currentRef.height_cm;
        const progress = heightCm - currentRef.height_cm;
        progressPct = range > 0 ? Math.min(100, Math.round((progress / range) * 100 * 100) / 100) : 100;
    } else if (!nextRef) {
        progressPct = 100; // Passed all references
    }

    return { currentRef, nextRef, progressPct };
}

// ── Ensure growth_journey + streak_shields rows exist ────────────────────────
async function ensureGrowthRows(conn, userId) {
    const [gjRows] = await conn.execute(
        'SELECT * FROM growth_journey WHERE user_id = ?', [userId]
    );
    if (!gjRows.length) {
        // New user: seed with welcome bonus
        await conn.execute(
            'INSERT INTO growth_journey (user_id, height_cm, current_ref_id) VALUES (?, ?, ?)',
            [userId, WELCOME_BONUS_CM, 'hand']
        );
        // Log the welcome bonus
        const today = new Date().toISOString().slice(0, 10);
        await conn.execute(
            `INSERT IGNORE INTO growth_journey_log (user_id, award_date, cm_gained, height_after, source)
             VALUES (?, ?, ?, ?, 'welcome_bonus')`,
            [userId, today, WELCOME_BONUS_CM, WELCOME_BONUS_CM]
        );
    }

    const [shieldRows] = await conn.execute(
        'SELECT * FROM streak_shields WHERE user_id = ?', [userId]
    );
    if (!shieldRows.length) {
        await conn.execute(
            'INSERT INTO streak_shields (user_id, shield_count) VALUES (?, 0)', [userId]
        );
    }

    // Re-fetch to return current state
    const [[gj]] = await conn.execute(
        'SELECT * FROM growth_journey WHERE user_id = ?', [userId]
    );
    const [[shields]] = await conn.execute(
        'SELECT * FROM streak_shields WHERE user_id = ?', [userId]
    );
    return { gj, shields };
}

// ── Internal award function — called from study.js/quizzes.js transactions ──
// Returns: { gained, newHeightCm, crossedNewRef, currentRef, nextRef, progressPct, shieldUsed, shieldsRemaining }
async function awardGrowth(conn, userId, source) {
    const { gj, shields } = await ensureGrowthRows(conn, userId);
    const today = new Date().toISOString().slice(0, 10);
    const lastAwarded = gj.last_awarded_date
        ? new Date(gj.last_awarded_date).toISOString().slice(0, 10)
        : null;

    // Already awarded today? Return current state with gained: 0
    if (lastAwarded === today) {
        const refObjects = await getRefObjects(conn);
        const { currentRef, nextRef, progressPct } = resolveRefs(refObjects, parseFloat(gj.height_cm));
        return {
            gained_cm: 0,
            new_height_cm: parseFloat(gj.height_cm),
            crossed_new_ref: false,
            current_ref: currentRef,
            next_ref: nextRef,
            progress_pct: progressPct,
            streak_protected: false,
            shields_remaining: shields.shield_count,
        };
    }

    // Award growth
    const oldHeight = parseFloat(gj.height_cm);
    const newHeight = oldHeight + CM_PER_DAY;

    // Resolve refs before and after to detect crossing
    const refObjects = await getRefObjects(conn);
    const oldRefs = resolveRefs(refObjects, oldHeight);
    const newRefs = resolveRefs(refObjects, newHeight);
    const crossedNewRef = (!oldRefs.currentRef && newRefs.currentRef) ||
        (oldRefs.currentRef && newRefs.currentRef &&
         oldRefs.currentRef.ref_id !== newRefs.currentRef.ref_id);

    const newRefId = newRefs.currentRef ? newRefs.currentRef.ref_id : gj.current_ref_id;

    // Update growth_journey
    await conn.execute(
        `UPDATE growth_journey
         SET height_cm = ?, last_awarded_date = ?, current_ref_id = ?,
             longest_streak = GREATEST(longest_streak, ?)
         WHERE user_id = ?`,
        [newHeight.toFixed(2), today, newRefId, gj.longest_streak || 0, userId]
    );

    // Insert log entry (IGNORE handles the unique constraint gracefully)
    await conn.execute(
        `INSERT IGNORE INTO growth_journey_log (user_id, award_date, cm_gained, height_after, source)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, today, CM_PER_DAY, newHeight.toFixed(2), source]
    );

    // Earn a shield charge (1 per qualifying day, capped at max_shields)
    const earnedDate = shields.last_earned_at
        ? new Date(shields.last_earned_at).toISOString().slice(0, 10)
        : null;
    if (earnedDate !== today && shields.shield_count < shields.max_shields) {
        await conn.execute(
            `UPDATE streak_shields
             SET shield_count = LEAST(shield_count + 1, max_shields), last_earned_at = ?
             WHERE user_id = ?`,
            [today, userId]
        );
    }

    // Re-fetch shields after potential earn
    const [[updatedShields]] = await conn.execute(
        'SELECT shield_count FROM streak_shields WHERE user_id = ?', [userId]
    );

    return {
        gained_cm: CM_PER_DAY,
        new_height_cm: newHeight,
        crossed_new_ref: crossedNewRef,
        current_ref: newRefs.currentRef,
        next_ref: newRefs.nextRef,
        progress_pct: newRefs.progressPct,
        streak_protected: false,
        shields_remaining: updatedShields.shield_count,
    };
}

// ── Auto-consume shield on streak break ─────────────────────────────────────
// Called from study.js when streakBroken is detected, BEFORE decay is applied
// Returns: { shieldUsed, shieldsRemaining }
async function tryAutoShield(conn, userId) {
    const [[shields]] = await conn.execute(
        'SELECT shield_count FROM streak_shields WHERE user_id = ?', [userId]
    );

    if (!shields || shields.shield_count <= 0) {
        return { shieldUsed: false, shieldsRemaining: 0 };
    }

    // Consume one shield
    await conn.execute(
        'UPDATE streak_shields SET shield_count = shield_count - 1 WHERE user_id = ?',
        [userId]
    );

    // Log the shield usage
    const today = new Date().toISOString().slice(0, 10);
    const [[gj]] = await conn.execute(
        'SELECT height_cm FROM growth_journey WHERE user_id = ?', [userId]
    );
    const heightCm = gj ? parseFloat(gj.height_cm) : 0;

    await conn.execute(
        `INSERT IGNORE INTO growth_journey_log (user_id, award_date, cm_gained, height_after, source)
         VALUES (?, ?, 0, ?, 'shield_used')`,
        [userId, today, heightCm.toFixed(2)]
    );

    const [[updated]] = await conn.execute(
        'SELECT shield_count FROM streak_shields WHERE user_id = ?', [userId]
    );

    return { shieldUsed: true, shieldsRemaining: updated.shield_count };
}

// ── GET /api/growth/state — read-only snapshot for widget/page mount ─────────
router.get('/state', auth, async (req, res) => {
    try {
        const conn = await db.getConnection();
        try {
            const { gj, shields } = await ensureGrowthRows(conn, req.user.user_id);
            const refObjects = await getRefObjects(conn);
            const heightCm = parseFloat(gj.height_cm);
            const { currentRef, nextRef, progressPct } = resolveRefs(refObjects, heightCm);

            // Get streak info from study_streak
            const [streakRows] = await conn.execute(
                'SELECT streak_days, last_study_date FROM study_streak WHERE user_id = ?',
                [req.user.user_id]
            );
            const streak = streakRows[0] || { streak_days: 0, last_study_date: null };

            // Check if at risk (hasn't studied today)
            const today = new Date().toISOString().slice(0, 10);
            const lastStudy = streak.last_study_date
                ? new Date(streak.last_study_date).toISOString().slice(0, 10)
                : null;
            const isAtRisk = streak.streak_days > 0 && lastStudy !== today;

            // Distance remaining to next ref
            const distanceRemainingCm = nextRef
                ? Math.max(0, nextRef.height_cm - heightCm)
                : 0;

            res.json({
                height_cm: heightCm,
                streak_days: streak.streak_days,
                longest_streak: gj.longest_streak,
                current_ref: currentRef,
                next_ref: nextRef,
                progress_pct: progressPct,
                distance_remaining_cm: distanceRemainingCm,
                shield_count: shields.shield_count,
                max_shields: shields.max_shields,
                is_at_risk: isAtRisk,
                created_at: gj.created_at,
            });
        } finally {
            conn.release();
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/growth/timeline — paginated log for Growth page ─────────────────
router.get('/timeline', auth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 60, 200);
    const offset = parseInt(req.query.offset) || 0;

    try {
        const [rows] = await db.execute(
            `SELECT log_id, award_date, cm_gained, height_after, source, created_at
             FROM growth_journey_log
             WHERE user_id = ?
             ORDER BY award_date DESC
             LIMIT ? OFFSET ?`,
            [req.user.user_id, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/growth/reference-objects — full ladder (cacheable) ───────────────
router.get('/reference-objects', auth, async (req, res) => {
    try {
        const refObjects = await getRefObjects();
        res.set('Cache-Control', 'public, max-age=3600');
        res.json(refObjects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/growth/achievements — derived achievement list ──────────────────
router.get('/achievements', auth, async (req, res) => {
    const userId = req.user.user_id;
    try {
        // Fetch growth state
        const [[gj]] = await db.execute(
            'SELECT height_cm, longest_streak, created_at FROM growth_journey WHERE user_id = ?',
            [userId]
        );
        if (!gj) return res.json({ achievements: [] });

        const heightCm = parseFloat(gj.height_cm);
        const refObjects = await getRefObjects();
        const achievements = [];

        // Crossed reference objects
        for (const ref of refObjects) {
            if (heightCm >= ref.height_cm) {
                achievements.push({
                    type: 'object_crossed',
                    id: `crossed-${ref.ref_id}`,
                    label: `Taller than: ${ref.label}`,
                    height_cm: ref.height_cm,
                    earned: true,
                });
            }
        }

        // Streak milestones
        const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
        for (const ms of streakMilestones) {
            achievements.push({
                type: 'streak_milestone',
                id: `streak-${ms}`,
                label: `${ms}-Day Streak`,
                earned: gj.longest_streak >= ms,
            });
        }

        // Height milestones
        const heightMilestones = [100, 500, 1000, 5000, 10000, 50000];
        for (const hm of heightMilestones) {
            achievements.push({
                type: 'height_milestone',
                id: `height-${hm}`,
                label: `Reached ${hm >= 100 ? (hm / 100).toFixed(0) + 'm' : hm + 'cm'}`,
                earned: heightCm >= hm,
            });
        }

        // Growth anniversary
        const daysSinceCreation = Math.floor(
            (Date.now() - new Date(gj.created_at).getTime()) / 86400000
        );
        const anniversaryMilestones = [30, 90, 180, 365];
        for (const am of anniversaryMilestones) {
            achievements.push({
                type: 'anniversary',
                id: `anniversary-${am}`,
                label: `Growing for ${am} days`,
                earned: daysSinceCreation >= am,
            });
        }

        res.json({
            achievements,
            stats: {
                height_cm: heightCm,
                longest_streak: gj.longest_streak,
                days_growing: daysSinceCreation,
                objects_crossed: achievements.filter(a => a.type === 'object_crossed' && a.earned).length,
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/growth/heatmap — calendar heatmap data ──────────────────────────
router.get('/heatmap', auth, async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    try {
        const [rows] = await db.execute(
            `SELECT award_date, SUM(cm_gained) AS total_cm, GROUP_CONCAT(source) AS sources
             FROM growth_journey_log
             WHERE user_id = ? AND YEAR(award_date) = ?
             GROUP BY award_date
             ORDER BY award_date ASC`,
            [req.user.user_id, year]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Export the router and internal functions for use in study.js/quizzes.js
module.exports = router;
module.exports.awardGrowth = awardGrowth;
module.exports.tryAutoShield = tryAutoShield;
module.exports.ensureGrowthRows = ensureGrowthRows;
module.exports.MIN_SESSION_SECONDS = MIN_SESSION_SECONDS;
module.exports.QUIZ_PASS_THRESHOLD = QUIZ_PASS_THRESHOLD;
