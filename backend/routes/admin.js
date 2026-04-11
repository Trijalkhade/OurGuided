const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { triggerBirthdayEmailsNow } = require('../utils/birthdayScheduler');
const db = require('../db');

/**
 * ADMIN ROUTES
 * ────────────
 * Routes for testing and maintenance features
 * Protected by auth middleware
 */

/**
 * Debug endpoint - Check database for birthdays today
 * GET /admin/check-birthdays-debug
 */
router.get('/check-birthdays-debug', auth, async (req, res) => {
    try {
        console.log(`[ADMIN] ${req.user.username} requested birthday debug info`);
        
        const query = `
            SELECT 
                u.user_id, 
                u.username, 
                u.email,
                DATE_FORMAT(up.dob, '%Y-%m-%d') as dob,
                MONTH(up.dob) as birth_month,
                DAY(up.dob) as birth_day,
                MONTH(CURDATE()) as current_month,
                DAY(CURDATE()) as current_day,
                ui.first_name,
                up.notify_email 
            FROM users u
            INNER JOIN user_info ui ON u.user_id = ui.user_id
            INNER JOIN user_profile up ON u.user_id = up.user_id
            ORDER BY up.dob DESC
            LIMIT 20
        `;
        
        const [users] = await db.execute(query);
        
        // Filter to show only today's birthdays
        const todaysBirthdays = users.filter(u => 
            u.birth_month === u.current_month && 
            u.birth_day === u.current_day
        );
        
        res.json({
            message: 'Birthday debug info',
            debug_info: {
                current_date: new Date().toISOString(),
                current_month: users.length > 0 ? users[0].current_month : 'N/A',
                current_day: users.length > 0 ? users[0].current_day : 'N/A',
                api_key_configured: !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_api_key_here',
                email_mode: process.env.EMAIL_MODE || 'auto'
            },
            todays_birthdays_count: todaysBirthdays.length,
            todays_birthdays: todaysBirthdays,
            all_users_sample: users.slice(0, 10)
        });
    } catch (err) {
        console.error('[ADMIN ERROR]', err);
        res.status(500).json({ 
            message: 'Failed to get birthday debug info',
            error: err.message 
        });
    }
});

/**
 * Manually trigger birthday emails for testing
 * GET /admin/test-birthdays
 */
router.get('/test-birthdays', auth, async (req, res) => {
    try {
        console.log(`[ADMIN] ${req.user.username} triggered birthday email test`);
        
        // Check if RESEND is configured
        if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_api_key_here') {
            return res.status(400).json({
                message: '⚠️  WARNING: RESEND_API_KEY is not configured!',
                warning: 'Birthday emails will be SIMULATED, not actually sent',
                setup_instructions: [
                    '1. Sign up at https://resend.com',
                    '2. Get API key from dashboard',
                    '3. Add to .env: RESEND_API_KEY=<your_key>',
                    '4. Restart server'
                ]
            });
        }
        
        const result = await triggerBirthdayEmailsNow();
        
        res.json({
            message: 'Birthday emails triggered',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[ADMIN ERROR]', err);
        res.status(500).json({ 
            message: 'Failed to trigger birthday emails',
            error: err.message 
        });
    }
});

/**
 * Check scheduler status
 * GET /admin/scheduler-status
 */
router.get('/scheduler-status', auth, async (req, res) => {
    res.json({
        scheduler_status: 'running',
        schedule_time: '7:00 PM daily',
        resend_configured: !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_api_key_here',
        email_mode: process.env.EMAIL_MODE || 'auto',
        current_time: new Date().toISOString()
    });
});

module.exports = router;
