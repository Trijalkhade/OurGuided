const { Resend } = require('resend');

/**
 * NOTIFIER UTILITY
 * ────────────────
 * Uses Resend API for email delivery (HTTPS, works on restricted networks)
 * 
 * SETUP:
 * 1. Sign up at https://resend.com (free tier available)
 * 2. Get your API key from dashboard
 * 3. Add to .env: RESEND_API_KEY=your_key_here
 * 4. Email will work even on college/corporate WiFi (HTTPS not blocked)
 */

const EMAIL_MODE = process.env.EMAIL_MODE || 'auto'; // 'auto', 'simulated', 'real'
let resend = null;

// Initialize Resend only if API key exists
if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_api_key_here') {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('[RESEND OK] Email service initialized');
} else {
    console.log('[INFO] RESEND_API_KEY not configured. Emails will be simulated.');
    console.log('[INFO] Set up Resend: https://resend.com (free tier available)');
}

/**
 * Sends an email notification using Resend API (HTTPS)
 * Works on college/corporate WiFi (SMTP not required)
 */
async function sendEmail(to, subject, text, retryCount = 0) {
    const MAX_RETRIES = 2;

    // Use simulation if explicitly set or no API key
    const shouldSimulate = EMAIL_MODE === 'simulated' || !resend;

    if (shouldSimulate) {
        console.log(`[SIMULATED EMAIL] To: ${to} | Subject: ${subject}`);
        return true;
    }

    try {
        // Format email with nice HTML template
        const html = formatEmailTemplate(subject, text);
        
        const result = await resend.emails.send({
            from: 'OurGuided <noreply@ourguided.tech>',
            to,
            subject,
            html
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        console.log(`[EMAIL OK] Sent to ${to} (ID: ${result.data.id})`);
        return true;
    } catch (err) {
        console.error(`[EMAIL ERROR] Attempt ${retryCount + 1}/${MAX_RETRIES + 1}: ${err.message}`);

        // Retry on transient errors
        if (retryCount < MAX_RETRIES && isTransientError(err)) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`[EMAIL RETRY] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendEmail(to, subject, text, retryCount + 1);
        }
        
        return false;
    }
}

/**
 * Formats email with professional HTML template
 */
function formatEmailTemplate(subject, message) {
    // Extract title from subject (remove "OurGuided: " prefix if present)
    const title = subject.replace('OurGuided: ', '');
    
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
        .content p { margin: 15px 0; }
        .highlight { background: #f0f4ff; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px; margin: 15px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📬 OurGuided</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p><strong>${title}</strong></p>
            <div class="highlight">
                ${message}
            </div>
            <div class="cta">
                <a href="https://ourguided.com" class="cta-button">View in OurGuided</a>
            </div>
            <p>Keep learning and stay connected! 🎓</p>
        </div>
        <div class="footer">
            <p>You received this email because notifications are enabled in your OurGuided account.<br>
            <a href="https://ourguided.com/settings">Manage notification preferences</a></p>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Determines if an error is transient (worth retrying)
 */
function isTransientError(err) {
    const transientPatterns = [
        'timeout',
        'ECONNREFUSED',
        'ECONNRESET',
        'temporarily unavailable'
    ];
    return transientPatterns.some(pattern => 
        err.message.toLowerCase().includes(pattern)
    );
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
