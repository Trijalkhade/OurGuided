const nodemailer = require('nodemailer');

/**
 * NOTIFIER UTILITY
 * ────────────────
 * This utility handles sending notifications via external channels.
 * 
 * To enable REAL Email delivery:
 * 1. Add SMTP_USER and SMTP_PASS to your .env file
 * 2. If using Gmail, use an "App Password"
 */

const isGmail = (process.env.SMTP_USER || '').includes('gmail.com');

const transporter = nodemailer.createTransport({
    host: isGmail ? 'smtp.gmail.com' : (process.env.SMTP_HOST || 'smtp.ethereal.email'),
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    family: 4 // Force IPv4 to avoid university network IPv6 issues
});

// Verify connection configuration on load
transporter.verify((error, success) => {
    if (error) {
        console.error('[SMTP ERROR] Connection failed:', error.message);
    }
});

/**
 * Sends an email notification
 */
async function sendEmail(to, subject, text) {
    if (!process.env.SMTP_USER) {
        console.log(`[SIMULATED EMAIL] To: ${to} | Sub: ${subject} | Body: ${text}`);
        return true;
    }

    try {
        await transporter.sendMail({
            from: '"OurGuided" <no-reply@ourguided.com>',
            to,
            subject,
            text
        });
        return true;
    } catch (err) {
        console.error('[ERROR] Failed to send email:', err.message);
        return false;
    }
}

/**
 * Sends a WhatsApp notification (Placeholder for Twilio/Meta API)
 */
async function sendWhatsApp(number, message) {
    console.log(`[SIMULATED WHATSAPP] To: ${number} | Msg: ${message}`);
    // In production, you would use:
    // const client = require('twilio')(sid, auth);
    // await client.messages.create({ from: 'whatsapp:+1...', to: `whatsapp:${number}`, body: message });
    return true;
}

module.exports = { sendEmail, sendWhatsApp };
