const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const auth    = require('../middleware/auth');
const postController = require('../controllers/postController');
const { globalActionLimiter } = require('../middleware/rateLimit');

/* ── POST ROUTES ── */

router.get('/feed',        auth, postController.getFeed);
router.get('/user/:id',    auth, postController.getUserPosts);
router.get('/watchlist',   auth, postController.getWatchlist);
router.get('/pending',     auth, postController.getPendingPosts);
router.get('/tag/:tag',    auth, postController.getPostsByTag);
router.get('/search',      auth, postController.searchPosts);
router.get('/:id',         auth, postController.getPostDetail);

router.post('/',           auth, globalActionLimiter, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 5 }]), postController.createPost);
router.delete('/:id',      auth, postController.deletePost);

router.post('/:id/approve', auth, postController.approvePost);
router.delete('/:id/reject', auth, postController.rejectPost);

router.post('/:id/like',      auth, postController.likePost);
router.post('/:id/watchlist', auth, postController.watchlistToggle);
router.post('/:id/comment',   auth, globalActionLimiter, postController.commentOnPost);
router.get('/:id/likers',    auth, postController.getPostLikers);

module.exports = router;