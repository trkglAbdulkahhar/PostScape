const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');
const upload = require('../middleware/upload');
const csurf = require('csurf');
const csrfProtection = csurf({ cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' } });

// 1. SPECIFIC ROUTES (Must be first)

// TEMP FIX: Reset all comments
router.get('/reset-comments', postsController.resetComments);

// GET /posts/add -> Create Post Form
router.get('/add', postsController.getAddPost);

// POST /posts -> Create Logic
router.post('/', upload.single('image'), csrfProtection, postsController.createPost);

// 1. EDIT PAGE (GET) - MUST BE ABOVE /:id
router.get('/edit/:id', postsController.getEditPost);

// 2. PROCESS EDIT (POST)
router.post('/edit/:id', upload.single('image'), csrfProtection, postsController.postEditPost);

// POST /posts/delete/:id (Process Delete)
router.post('/delete/:id', postsController.deletePost);

// GET /posts/mine -> User's Own Posts
router.get(['/mine', '/my-posts'], postsController.getMyPosts);

// 2. ACTION ROUTES (Like/Save/Comment)

// POST /like/:id
router.post('/like/:id', postsController.likePost);

// POST /save/:id
router.post('/save/:id', postsController.savePost);

// GET /posts/:slug/comments -> The Dedicated Split-View Page
router.get('/:slug/comments', postsController.getComments);

// POST /comment/:id
router.post('/comment/:id', postsController.postComment);

// 3. DYNAMIC ROUTE (Must be LAST)
// GET /posts/:slug -> VIEW SINGLE POST (Updated for Slug)
router.get('/:slug', postsController.getPost);

// POST /track-click/:postId (Interest Tracking)
router.post('/track-click/:postId', postsController.trackClick);

module.exports = router;
