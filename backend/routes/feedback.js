const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_api_key_here'
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const ADMIN_EMAIL = 'trijalkhadekop13@gmail.com';

/* ─── Emoji map for feedback types ─────────────────────────────────────────── */
const TYPE_META = {
    Complaint:   { emoji: '😤', color: '#ef4444', label: 'Complaint' },
    Compliment:  { emoji: '🌟', color: '#f59e0b', label: 'Compliment' },
    Suggestion:  { emoji: '💡', color: '#3b5bfa', label: 'Suggestion' },
    View:        { emoji: '💬', color: '#8b5cf6', label: 'View / Opinion' },
    Other:       { emoji: '📝', color: '#6b7280', label: 'Other' },
};

/* ─── HTML email template for admin ────────────────────────────────────────── */
function buildAdminEmail({ type, content, username, email, rating, timestamp }) {
    const meta = TYPE_META[type] || TYPE_META.Other;
    const stars = rating ? '⭐'.repeat(rating) + '☆'.repeat(5 - rating) : 'Not rated';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#f0f2f8; font-family:'Segoe UI',sans-serif; color:#0d1a38; }
  .wrap { max-width:600px; margin:32px auto; }
  .card { background:#fff; border-radius:16px; overflow:hidden; border:1px solid #dde2ef; }
  .hdr  { background:linear-gradient(135deg,${meta.color} 0%,${meta.color}cc 100%); padding:32px 28px; text-align:center; }
  .hdr .icon { font-size:48px; display:block; margin-bottom:12px; }
  .hdr h1 { color:#fff; font-size:22px; margin:0; }
  .hdr .badge { display:inline-block; background:rgba(255,255,255,.22); color:#fff;
    font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase;
    padding:4px 14px; border-radius:20px; margin-top:8px; }
  .body { padding:28px; }
  .field { margin-bottom:18px; }
  .field-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.4px;
    color:#8892b5; margin-bottom:6px; font-family:monospace; }
  .field-value { background:#f0f2f8; border-left:4px solid ${meta.color}; border-radius:6px;
    padding:12px 15px; font-size:14px; line-height:1.7; color:#0d1a38; white-space:pre-wrap; word-break:break-word; }
  .field-value.plain { border-left-color:#dde2ef; background:#f8f9fc; }
  .meta-row { display:flex; gap:12px; }
  .meta-row .field { flex:1; }
  .footer { border-top:1px solid #dde2ef; padding:18px 28px; text-align:center;
    font-size:12px; color:#8892b5; }
  .footer a { color:#3b5bfa; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <span class="icon">${meta.emoji}</span>
      <h1>New ${meta.label} — OurGuided</h1>
      <span class="badge">Platform Feedback</span>
    </div>
    <div class="body">
      <div class="meta-row">
        <div class="field">
          <div class="field-label">From</div>
          <div class="field-value plain">${username} &lt;${email}&gt;</div>
        </div>
        <div class="field">
          <div class="field-label">Rating</div>
          <div class="field-value plain">${stars}</div>
        </div>
      </div>
      <div class="meta-row">
        <div class="field">
          <div class="field-label">Category</div>
          <div class="field-value plain">${meta.emoji} ${meta.label}</div>
        </div>
        <div class="field">
          <div class="field-label">Submitted</div>
          <div class="field-value plain">${timestamp}</div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">Message</div>
        <div class="field-value">${content}</div>
      </div>
    </div>
    <div class="footer">
      OurGuided Platform &nbsp;·&nbsp; <a href="https://www.ourguided.tech">ourguided.tech</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

/* ─── HTML email template for user (confirmation copy) ─────────────────────── */
function buildUserEmail({ type, content, username, rating, timestamp }) {
    const meta = TYPE_META[type] || TYPE_META.Other;
    const stars = rating ? '⭐'.repeat(rating) + '☆'.repeat(5 - rating) : 'Not rated';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#f0f2f8; font-family:'Segoe UI',sans-serif; color:#0d1a38; }
  .wrap { max-width:600px; margin:32px auto; }
  .card { background:#fff; border-radius:16px; overflow:hidden; border:1px solid #dde2ef; }
  .hdr  { background:linear-gradient(135deg,#3b5bfa 0%,#06b6d4 100%); padding:32px 28px; text-align:center; }
  .hdr .icon { font-size:48px; display:block; margin-bottom:12px; }
  .hdr h1 { color:#fff; font-size:22px; margin:0; }
  .hdr p  { color:rgba(255,255,255,.8); font-size:14px; margin-top:8px; }
  .body { padding:28px; }
  .thanks { font-size:16px; font-weight:600; margin-bottom:16px; color:#0d1a38; }
  .sub { font-size:14px; color:#455070; line-height:1.7; margin-bottom:22px; }
  .field { margin-bottom:16px; }
  .field-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.4px;
    color:#8892b5; margin-bottom:6px; font-family:monospace; }
  .field-value { background:#f0f2f8; border-left:4px solid #3b5bfa; border-radius:6px;
    padding:12px 15px; font-size:14px; line-height:1.7; color:#0d1a38; white-space:pre-wrap; word-break:break-word;}
  .field-value.plain { border-left-color:#dde2ef; background:#f8f9fc; }
  .cta { text-align:center; margin:24px 0 8px; }
  .cta a { display:inline-block; background:linear-gradient(135deg,#3b5bfa,#2243e0);
    color:#fff; text-decoration:none; padding:12px 32px; border-radius:10px;
    font-weight:600; font-size:14px; }
  .footer { border-top:1px solid #dde2ef; padding:18px 28px; text-align:center;
    font-size:12px; color:#8892b5; }
  .footer a { color:#3b5bfa; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <span class="icon">✅</span>
      <h1>We received your feedback!</h1>
      <p>Hi ${username}, thanks for taking the time to reach out.</p>
    </div>
    <div class="body">
      <p class="thanks">Your ${meta.label.toLowerCase()} has been submitted.</p>
      <p class="sub">We read every piece of feedback and use it to make OurGuided better. 
      We'll get back to you if needed.</p>
      <div class="field">
        <div class="field-label">Category</div>
        <div class="field-value plain">${meta.emoji} ${meta.label}</div>
      </div>
      <div class="field">
        <div class="field-label">Your Rating</div>
        <div class="field-value plain">${stars}</div>
      </div>
      <div class="field">
        <div class="field-label">Your Message</div>
        <div class="field-value">${content}</div>
      </div>
      <div class="field">
        <div class="field-label">Submitted At</div>
        <div class="field-value plain">${timestamp}</div>
      </div>
      <div class="cta">
        <a href="https://www.ourguided.tech">Return to OurGuided</a>
      </div>
    </div>
    <div class="footer">
      Learn. Guide. Grow. &nbsp;·&nbsp; The OurGuided Team<br/>
      <a href="https://www.ourguided.tech">ourguided.tech</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

/* ─── POST /api/feedback ─────────────────────────────────────────────────────
   Auth required — user info pulled from JWT.
   Body: { type, content, rating? }
─────────────────────────────────────────────────────────────────────────────── */
router.post('/', auth, async (req, res) => {
    const { type, content, rating } = req.body;
    const { user_id, username } = req.user;

    if (!type || !content || !content.trim()) {
        return res.status(400).json({ message: 'Feedback type and message are required.' });
    }

    const validTypes = ['Complaint', 'Compliment', 'Suggestion', 'View', 'Other'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid feedback type.' });
    }

    if (content.trim().length < 10) {
        return res.status(400).json({ message: 'Feedback must be at least 10 characters.' });
    }

    // Fetch user's email from DB
    let userEmail = null;
    try {
        const db = require('../db');
        const [rows] = await db.execute('SELECT email FROM users WHERE user_id = ?', [user_id]);
        if (rows.length) userEmail = rows[0].email;
    } catch (e) {
        console.error('[FEEDBACK] DB lookup failed:', e.message);
    }

    const timestamp = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const payload = {
        type, content: content.trim(),
        username, email: userEmail || 'unknown',
        rating: rating || 0, timestamp
    };

    if (!resend) {
        // Simulated (no Resend key)
        console.log(`[FEEDBACK SIMULATED] From: ${username} | Type: ${type} | Rating: ${rating}`);
        console.log(`[FEEDBACK] Content: ${content.trim()}`);
        return res.json({ message: 'Feedback received! (email simulated in dev mode)' });
    }

    try {
        const adminHtml = buildAdminEmail(payload);
        const userHtml  = buildUserEmail(payload);

        const meta = TYPE_META[type] || TYPE_META.Other;

        // ── Send to admin ──────────────────────────────────────────────
        console.log(`[FEEDBACK] Sending admin email to: ${ADMIN_EMAIL}`);
        const adminResult = await resend.emails.send({
            from:    'OurGuided Feedback <noreply@ourguided.tech>',
            to:      ADMIN_EMAIL,
            subject: `${meta.emoji} [${type}] from ${username} — OurGuided`,
            html:    adminHtml,
        });

        if (adminResult.error) {
            console.error('[FEEDBACK] Admin email Resend error:', JSON.stringify(adminResult.error));
            return res.status(502).json({
                message: `Email delivery failed: ${adminResult.error.message || adminResult.error.name}. Check domain verification at resend.com.`
            });
        }

        console.log(`[FEEDBACK] ✅ Admin email sent (ID: ${adminResult.data?.id})`);

        // ── Send copy to user (best effort) ────────────────────────────
        if (userEmail) {
            console.log(`[FEEDBACK] Sending user copy to: ${userEmail}`);
            const userResult = await resend.emails.send({
                from:    'OurGuided <noreply@ourguided.tech>',
                to:      userEmail,
                subject: `We got your feedback, ${username}! 📬`,
                html:    userHtml,
            });
            if (userResult.error) {
                console.warn('[FEEDBACK] User copy Resend error:', JSON.stringify(userResult.error));
            } else {
                console.log(`[FEEDBACK] ✅ User copy sent (ID: ${userResult.data?.id})`);
            }
        }

        res.json({ message: 'Thank you! Your feedback has been sent and a copy is in your inbox.' });
    } catch (err) {
        console.error('[FEEDBACK] Unexpected error:', err.message, err.stack);
        res.status(500).json({ message: `Failed to send feedback: ${err.message}` });
    }
});

module.exports = router;
