const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// GET / -> Redirect to Feed (All Posts)
router.get('/', indexController.getLanding);

// GET /feed -> "ALL POSTS" PAGE (The Global Stream)
router.get('/feed', indexController.getFeed);

// GET /following -> "FOLLOWING" PAGE (Dedicated)
router.get(['/following', '/following-feed'], indexController.getFollowingFeed);

// GET /dashboard -> "MY DASHBOARD" (Profile & Personal Stuff)
router.get('/dashboard', indexController.getDashboard);

// GET /search-api -> AJAX Hybrid Search
router.get('/search-api', indexController.getSearchApi);

// GET /search -> Hybrid Search (Users + Posts)
router.get('/search', indexController.getSearch);

// GET - Formu göster (Setup Profile)
router.get('/setup-profile', indexController.getSetupProfile);

// POST - Verileri kaydet ve profili tamamla (Setup Profile)
router.post('/setup-profile', indexController.postSetupProfile);

module.exports = router;
