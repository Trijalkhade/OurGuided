const db = require('./db');
const moderationService = require('./utils/moderationService');

async function scanExistingComments() {
  try {
    console.log('Fetching all active comments for scanning...');
    const [comments] = await db.execute(
      'SELECT comment_id, user_id, content FROM comments WHERE is_deleted = FALSE'
    );
    
    console.log(`Found ${comments.length} comments. Sending to moderation queue...`);
    
    for (const comment of comments) {
      // Queue for background logic (this will handle AI call, Delete, and Logging)
      await moderationService.queueForDetection({
        type: 'comment',
        id: comment.comment_id,
        userId: comment.user_id,
        content: comment.content
      });
      console.log(`Queued comment ${comment.comment_id}`);
    }
    
    console.log('\n✅ All comments have been queued. The background moderation worker is now processing them.');
    console.log('Refresh your site in a few moments to see the cleaned results!');
    
    // Give it a second to kick off before exiting
    setTimeout(() => process.exit(0), 2000);
  } catch (error) {
    console.error('Error scanning comments:', error);
    process.exit(1);
  }
}

scanExistingComments();
