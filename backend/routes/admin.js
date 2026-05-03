const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { triggerBirthdayEmailsNow } = require('../utils/birthdayScheduler');
const db = require('../db');
const moderationLogger = require('../utils/moderationLogger');
const moderationService = require('../utils/moderationService');

/**
 * ADMIN ROUTES
 */

router.get('/check-birthdays-debug', auth, async (req, res) => {
    try {
        const query = `
            SELECT u.user_id, u.username, u.email,
                   DATE_FORMAT(up.dob, '%Y-%m-%d') as dob,
                   MONTH(up.dob) as birth_month, DAY(up.dob) as birth_day,
                   MONTH(CURDATE()) as current_month, DAY(CURDATE()) as current_day,
                   ui.first_name, up.notify_email 
            FROM users u
            INNER JOIN user_info ui ON u.user_id = ui.user_id
            INNER JOIN user_profile up ON u.user_id = up.user_id
            ORDER BY up.dob DESC LIMIT 20
        `;
        const [users] = await db.execute(query);
        const todaysBirthdays = users.filter(u => u.birth_month === u.current_month && u.birth_day === u.current_day);
        
        res.json({
            message: 'Birthday debug info',
            todays_birthdays: todaysBirthdays,
            all_users_sample: users.slice(0, 5)
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/test-birthdays', auth, async (req, res) => {
    try {
        const result = await triggerBirthdayEmailsNow();
        res.json({ message: 'Birthday emails triggered', result });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── MODERATION ENDPOINTS ── */

router.get('/moderation/stats', auth, async (req, res) => {
    try {
        const stats = await moderationService.getQueueStats();
        res.json({ success: true, data: stats });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/moderation/logs', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await moderationLogger.getRecentLogs(limit);
        res.json({ success: true, data: logs });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/moderation/queue', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const queue = await moderationService.getModerationQueue(limit, offset);
        res.json({ success: true, data: queue });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/moderation/:queueId/decision', auth, async (req, res) => {
    try {
        const { decision, notes } = req.body;
        await moderationService.processModerationDecision(req.params.queueId, req.user.user_id, decision, notes || '');
        res.json({ success: true, message: `Moderation decision processed: ${decision}` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/moderation/deletions', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const logs = await moderationService.getDeletionLogs(limit, offset);
        res.json({ success: true, data: logs });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/moderation/scan', auth, async (req, res) => {
    try {
        const { content_type, limit = 100 } = req.body;
        const configs = {
            post: { table: 'posts', id: 'post_id', content: 'text' },
            comment: { table: 'comments', id: 'comment_id', content: 'content' },
            quiz: { table: 'quizzes', id: 'quiz_id', content: 'title' }
        };
        const config = configs[content_type];
        if (!config) return res.status(400).json({ message: 'Invalid content type' });

        const [content] = await db.execute(`
            SELECT ${config.id}, ${config.content}, user_id FROM ${config.table} 
            WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT ?
        `, [limit]);

        for (const item of content) {
            if (item[config.content]) {
                await moderationService.queueForDetection({
                    type: content_type,
                    id: item[config.id],
                    userId: item.user_id,
                    content: item[config.content]
                });
            }
        }
        res.json({ success: true, message: `Queued ${content.length} ${content_type}s for scan` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
