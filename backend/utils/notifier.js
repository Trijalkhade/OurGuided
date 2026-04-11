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
        .highlight { background: #f0f4ff; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px; margin: 15px 0; white-space: pre-wrap; word-wrap: break-word; }
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
                <a href="https://www.ourguided.tech" class="cta-button">View in OurGuided</a>
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

/**
 * Formats birthday email as responsive HTML card
 */
function formatBirthdayEmail(firstName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Happy Birthday!</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    * { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; background-color: #f4f4f8; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; }

    /* Wrapper */
    .email-wrapper { width: 100%; background-color: #f4f4f8; padding: 32px 16px; }
    .email-card {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #e8e8f0;
    }

    /* Header band */
    .header-band {
      background-color: #7F77DD;
      padding: 36px 24px 28px;
      text-align: center;
    }
    .cake-icon {
      font-size: 52px;
      line-height: 1;
      display: block;
      margin-bottom: 12px;
    }
    .badge {
      display: inline-block;
      background-color: rgba(255,255,255,0.22);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 16px;
      border-radius: 20px;
    }

    /* Body */
    .body-content {
      padding: 32px 28px 28px;
      text-align: center;
    }
    .headline {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .divider {
      height: 1px;
      background-color: #ebebf0;
      margin: 0 0 20px;
      border: none;
    }
    .subtext {
      font-size: 15px;
      color: #555570;
      line-height: 1.7;
      margin: 0 0 24px;
    }

    /* Tags row */
    .tags {
      display: inline-block;
      text-align: center;
      margin-bottom: 28px;
    }
    .tag {
      display: inline-block;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 14px;
      border-radius: 20px;
      margin: 4px 3px;
      white-space: nowrap;
    }
    .tag-green  { background-color: #E1F5EE; color: #085041; }
    .tag-orange { background-color: #FAECE7; color: #712B13; }
    .tag-amber  { background-color: #FAEEDA; color: #633806; }

    /* CTA button */
    .cta-wrap { text-align: center; margin-bottom: 28px; }
    .cta-btn {
      display: inline-block;
      background-color: #7F77DD;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 13px 32px;
      border-radius: 10px;
      letter-spacing: 0.02em;
    }

    /* Footer */
    .card-footer {
      border-top: 1px solid #ebebf0;
      padding: 18px 28px;
      text-align: center;
      font-size: 12px;
      color: #aaaabc;
      line-height: 1.6;
    }
    .card-footer a { color: #7F77DD; text-decoration: none; }

    /* Responsive */
    @media only screen and (max-width: 560px) {
      .email-wrapper { padding: 16px 10px; }
      .header-band   { padding: 28px 16px 22px; }
      .cake-icon     { font-size: 44px; }
      .body-content  { padding: 24px 18px 20px; }
      .headline      { font-size: 17px; }
      .subtext       { font-size: 14px; }
      .cta-btn       { padding: 12px 24px; font-size: 13px; }
      .card-footer   { padding: 16px 18px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">

      <!-- Header -->
      <div class="header-band">
        <span class="cake-icon">🎂</span>
        <span class="badge">Happy Birthday</span>
      </div>

      <!-- Body -->
      <div class="body-content">
        <p class="headline">
          Hope your day is better than your GPA<br />and longer than your spring break, ${firstName}!
        </p>

        <hr class="divider" />

        <p class="subtext">
          You deserve a break from deadlines — at least for today.<br />
          Cheers to another year of surviving on caffeine and chaos!
        </p>

        <div class="tags">
          <span class="tag tag-green">No assignments today</span>
          <span class="tag tag-orange">Extra caffeine allowed</span>
          <span class="tag tag-amber">Chaos is valid</span>
        </div>

        <div class="cta-wrap">
          <a href="https://www.ourguided.tech" class="cta-btn">Open OurGuided</a>
        </div>
      </div>

      <!-- Footer -->
      <div class="card-footer">
        Learn. Guide. Grow. &nbsp;·&nbsp; The OurGuided Team<br />
        <a href="https://ourguided.com/settings">Manage notification preferences</a>
      </div>

    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends birthday email with special HTML card (bypasses standard template)
 */
async function sendBirthdayEmail(to, firstName, retryCount = 0) {
    const MAX_RETRIES = 2;
    const shouldSimulate = EMAIL_MODE === 'simulated' || !resend;

    if (shouldSimulate) {
        return true;
    }

    try {
        const html = formatBirthdayEmail(firstName);
        
        const result = await resend.emails.send({
            from: 'OurGuided <noreply@ourguided.tech>',
            to,
            subject: `Happy Birthday ${firstName}! 🎉`,
            html
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        console.log(`[BIRTHDAY] ✅ Sent to ${to}`);
        return true;
    } catch (err) {
        if (retryCount < MAX_RETRIES && isTransientError(err)) {
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendBirthdayEmail(to, firstName, retryCount + 1);
        }
        
        console.error(`[BIRTHDAY] ❌ Failed to send to ${to}: ${err.message}`);
        return false;
    }
}

/**
 * Sends birthday emails to users who have birthdays today
 * Runs daily at 2:50 PM
 */
async function sendBirthdayEmails() {
    try {
        const db = require('../db');
        
        // Query users with birthdays today
        const [users] = await db.execute(`
            SELECT 
                u.user_id, 
                u.username, 
                u.email, 
                ui.first_name,
                up.notify_email 
            FROM users u
            INNER JOIN user_info ui ON u.user_id = ui.user_id
            INNER JOIN user_profile up ON u.user_id = up.user_id
            WHERE 
                MONTH(up.dob) = MONTH(CURDATE()) 
                AND DAY(up.dob) = DAY(CURDATE())
                AND up.notify_email = TRUE
        `);

        if (users.length === 0) {
            return { sent: 0, failed: 0, users_found: 0 };
        }

        let sent = 0;
        let failed = 0;

        for (const user of users) {
            try {
                const firstName = user.first_name && user.first_name.trim() ? user.first_name : user.username;
                
                const result = await sendBirthdayEmail(user.email, firstName);

                if (result) {
                    sent++;
                } else {
                    failed++;
                }
            } catch (err) {
                console.error(`[BIRTHDAY] Error sending to ${user.username}: ${err.message}`);
                failed++;
            }
        }

        if (sent > 0 || failed > 0) {
            console.log(`[BIRTHDAY] Sent: ${sent}, Failed: ${failed}`);
        }
        
        return { sent, failed, users_found: users.length };
    } catch (err) {
        console.error('[BIRTHDAY] Error:', err.message);
        return { sent: 0, failed: 0, error: err.message };
    }
}

module.exports = { sendEmail, sendWhatsApp, sendBirthdayEmails, sendBirthdayEmail };
