const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET - User Search API for Autocomplete
router.get('/search-users', userController.searchUsers);

// User Dashboard - MOVED TO index.js
// router.get('/dashboard', ...);

// Toggle Follow / Unfollow User (Instant - No Request)
router.post('/follow/:id', userController.toggleFollow);

// TAKİPÇİLER SAYFASI
router.get('/followers/:id', userController.getFollowers);

// TAKİP EDİLENLER SAYFASI
router.get('/following/:id', userController.getFollowing);

// POST /user/remove-follower/:id
router.post('/remove-follower/:id', userController.removeFollower);

module.exports = router;
