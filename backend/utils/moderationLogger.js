const db = require('../db');

class ModerationLogger {
  async logDetection(userId, postId, content, detectionResult, contentType = 'post') {
    const conn = await db.getConnection();
    try {
      await conn.execute(`
        INSERT INTO moderation_logs 
        (user_id, post_id, content, content_type, is_hate_speech, confidence, 
         reasons, detection_details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        contentType === 'post' ? postId : null, // Fix: Only link to posts table if it's actually a post
        content,
        contentType,
        detectionResult.isHateSpeech || false,
        detectionResult.confidence || 0,
        JSON.stringify(detectionResult.reasons || []),
        JSON.stringify(detectionResult.details || null)
      ]);
    } catch (error) {
      console.error('Moderation logging error:', error);
    } finally {
      conn.release();
    }
  }

  async getModerationStats(days = 7) {
    const conn = await db.getConnection();
    try {
      const [stats] = await conn.execute(`
        SELECT 
          COUNT(*) as total_checks,
          SUM(is_hate_speech) as flagged_count,
          AVG(confidence) as avg_confidence,
          DATE(created_at) as date
        FROM moderation_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [days]);
      
      return stats;
    } catch (error) {
      console.error('Stats error:', error);
      return [];
    } finally {
      conn.release();
    }
  }

  async getRecentLogs(limit = 100) {
    const conn = await db.getConnection();
    try {
      const [logs] = await conn.execute(`
        SELECT ml.*, u.username 
        FROM moderation_logs ml
        JOIN users u ON ml.user_id = u.user_id
        ORDER BY ml.created_at DESC 
        LIMIT ?
      `, [limit]);
      
      return logs;
    } catch (error) {
      console.error('Logs error:', error);
      return [];
    } finally {
      conn.release();
    }
  }
}

module.exports = new ModerationLogger();
