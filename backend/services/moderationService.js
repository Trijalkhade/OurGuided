const { GoogleGenerativeAI } = require('@google/generative-ai');
const moderationLogger = require('../utils/moderationLogger');
const db = require('../db');
const { createNotification } = require('../routes/notifications');

class ModerationService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.geminiModelName = "gemini-flash-latest";
    
    // Safety Keywords
    this.keywords = [
      'fuck', 'shit', 'bitch', 'asshole', 'kill', 'die', 'suicide', 'bomb', 
      'cult', 'shutup', 'bastard', 'piss', 'dick', 'pussy', 'slut'
    ];
  }

  /* ── INTERNAL: Detection Engine ── */
  
  async _detectHateSpeech(text) {
    if (!text || typeof text !== 'string') {
      return { isHateSpeech: false, confidence: 0, reasons: [] };
    }

    // 1. Local Keyword Filter
    const lowerText = text.toLowerCase();
    const foundKeywords = this.keywords.filter(word => lowerText.includes(word));
    if (foundKeywords.length > 0) {
      return {
        isHateSpeech: true,
        confidence: 0.85,
        reasons: [`Inappropriate language detected: ${foundKeywords.join(', ')}`],
        strategy: 'local-filter'
      };
    }

    // 2. AI Prompt
    const prompt = `
      Analyze for a social learning platform:
      1. Hate speech, discrimination, or severe profanity.
      2. Harassment or PURELY BERATING others.
      3. No educational value (no teaching, hacks, facts) + used only to demean.

      Return ONLY JSON:
      {
        "isHateSpeech": boolean,
        "confidence": number (0-1),
        "reasons": string[],
        "detectedLanguage": string
      }

      Content: "${text}"
    `;

    // Try Gemini
    try {
      const model = this.genAI.getGenerativeModel({ model: this.geminiModelName, generationConfig: { responseMimeType: "application/json" } }, { apiVersion: 'v1beta' });
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      return { ...data, model: this.geminiModelName, strategy: 'gemini' };
    } catch (e) {
      // Try ChatGPT Fallback
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt + "\nRespond with valid JSON only." }],
            response_format: { type: "json_object" }
          })
        });
        const chatData = await response.json();
        if (chatData.error) throw new Error(chatData.error.message);
        const content = JSON.parse(chatData.choices[0].message.content);
        return { ...content, model: 'gpt-4o-mini', strategy: 'openai' };
      } catch (e2) {
        // Quota safety
        return { 
          isHateSpeech: true, 
          confidence: 0.5, 
          reasons: ['Engines quota hit. Review required.'], 
          strategy: 'fallback',
          details: { error: e2.message },
          language: 'unknown'
        };
      }
    }
  }

  /* ── EXTERNAL: Service Logic ── */

  async queueForDetection(contentData) {
    try {
      await db.execute(
        `INSERT INTO moderation_queue (content_type, content_id, user_id, content, status, created_at) 
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [contentData.type, contentData.id, contentData.userId, contentData.content]
      );
      this.startBackgroundProcessing();
    } catch (error) { console.error('Failed to queue:', error); }
  }

  startBackgroundProcessing() { this.processQueue(); }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      while (true) {
        const [items] = await db.execute('SELECT * FROM moderation_queue WHERE status = "pending" ORDER BY created_at ASC LIMIT 1');
        if (items.length === 0) break;
        await this.processContent(items[0]);
      }
    } catch (e) { console.error('Queue Error:', e); }
    finally { this.isProcessing = false; }
  }

  async processContent(queueItem) {
    try {
      await db.execute('UPDATE moderation_queue SET status = "processing", processed_at = NOW() WHERE queue_id = ?', [queueItem.queue_id]);
      const res = await this._detectHateSpeech(queueItem.content);
      
      await moderationLogger.logDetection(queueItem.user_id, queueItem.content_id, queueItem.content, res, queueItem.content_type);

      if (res.isHateSpeech) {
        const confidence = res.confidence || 0;
        // All flagged content (>=0.4) is hidden until review
        await this.autoDeleteContent(queueItem, res);
        const status = confidence > 0.7 ? "deleted" : "moderated";
        await db.execute('UPDATE moderation_queue SET status = ?, detection_confidence = ?, detection_details = ? WHERE queue_id = ?',
          [status, confidence, JSON.stringify(res), queueItem.queue_id]);
      } else {
        await db.execute('UPDATE moderation_queue SET status = "moderated", detection_confidence = ?, detection_details = ? WHERE queue_id = ?',
          [res.confidence || 0, JSON.stringify(res), queueItem.queue_id]);
      }
    } catch (e) { 
      await db.execute('UPDATE moderation_queue SET status = "pending" WHERE queue_id = ?', [queueItem.queue_id]);
    }
  }

  async autoDeleteContent(queueItem, res) {
    try {
      const table = queueItem.content_type === 'post' ? 'posts' : queueItem.content_type === 'comment' ? 'comments' : 'quizzes';
      const idCol = queueItem.content_type === 'post' ? 'post_id' : queueItem.content_type === 'comment' ? 'comment_id' : 'quiz_id';
      
      await db.execute(`UPDATE ${table} SET is_deleted = TRUE, deleted_at = NOW() WHERE ${idCol} = ?`, [queueItem.content_id]);
      
      await db.execute(`INSERT INTO content_deletions (content_type, content_id, user_id, reason, confidence, detection_details) VALUES (?,?,?,?,?,?)`,
        [queueItem.content_type, queueItem.content_id, queueItem.user_id, res.reasons.join(', '), res.confidence, JSON.stringify(res)]);

      await createNotification(queueItem.user_id, 'moderation', 'Content Removed', `Your ${queueItem.content_type} was hidden/removed for community guideline violations.`);
    } catch (e) { console.error('Auto-delete error:', e); }
  }

  async restoreContent(queueItem) {
    try {
      const table = queueItem.content_type === 'post' ? 'posts' : queueItem.content_type === 'comment' ? 'comments' : 'quizzes';
      const idCol = queueItem.content_type === 'post' ? 'post_id' : queueItem.content_type === 'comment' ? 'comment_id' : 'quiz_id';
      await db.execute(`UPDATE ${table} SET is_deleted = FALSE, deleted_at = NULL WHERE ${idCol} = ?`, [queueItem.content_id]);
      await createNotification(queueItem.user_id, 'moderation', 'Content Restored', `Your ${queueItem.content_type} has been restored following review.`);
    } catch (e) { console.error('Restore error:', e); }
  }

  startPeriodicProcessing(intervalMs = 30000) {
    if (this.processingInterval) clearInterval(this.processingInterval);
    this.processingInterval = setInterval(() => this.processQueue(), intervalMs);
    console.log(`Moderation service active (${intervalMs}ms)`);
  }
}

const instance = new ModerationService();
module.exports = instance;
module.exports.startBackgroundModeration = () => instance.startPeriodicProcessing();
