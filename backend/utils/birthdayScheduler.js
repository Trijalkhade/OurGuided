const cron = require('node-cron');
const { sendBirthdayEmails } = require('./notifier');

/**
 * BIRTHDAY SCHEDULER
 * ─────────────────
 * Sends birthday emails to users every day at 2:30 PM
 * 
 * Cron format: minute hour day month dayOfWeek
 * "30 14 * * *" = 30 minutes past 14:00 (2:30 PM) every day
 */

let scheduler = null;

/**
 * Initializes the birthday scheduler
 * Call this in your server startup (server.js)
 */
function initBirthdayScheduler() {
    if (scheduler) {
        return;
    }

    // Schedule for 7:00 PM daily
    scheduler = cron.schedule('00 19 * * *', async () => {
        await sendBirthdayEmails();
    });

    console.log('[SCHEDULER] ✅ Birthday scheduler initialized (7:00 PM daily)');
    return scheduler;
}

module.exports = { 
    initBirthdayScheduler
};
