const express = require('express');
const router = express.Router();

const User = require('../models/User'); // Ensure User model is required
const Post = require('../models/Post'); // Ensure Post model is required

// GET - Formu göster (Setup Profile)
router.get('/setup-profile', (req, res) => {
    if (!req.session.user) return res.redirect('/auth/login');
    res.render('setup-profile', { layout: 'main', user: req.session.user });
});

// POST - Verileri kaydet ve profili tamamla (Setup Profile)
router.post('/setup-profile', async (req, res) => {
    try {
        const { firstName, lastName, nickname, jobTitle, age, linkedinUrl, githubUrl, bio } = req.body;

        // Update user in DB
        await User.findByIdAndUpdate(req.session.user._id, {
            firstName, lastName, nickname, jobTitle, age, linkedinUrl, githubUrl, bio,
            isProfileComplete: true
        });

        // Update session user to reflect changes immediately
        req.session.user.firstName = firstName;
        req.session.user.lastName = lastName;
        req.session.user.nickname = nickname;
        req.session.user.jobTitle = jobTitle;
        req.session.user.age = age;
        req.session.user.isProfileComplete = true;

        res.redirect('/dashboard');
    } catch (err) {
        console.error("Setup Profile Error:", err);
        res.redirect('/setup-profile');
    }
});

// GET - User Search API for Autocomplete
router.get('/search-users', async (req, res) => {
    const query = req.query.query;
    if (!query || query.length < 1) return res.json([]);

    try {
        // Search by firstName or nickname (case-insensitive)
        const users = await User.find({
            $or: [
                { firstName: { $regex: query, $options: 'i' } },
                { nickname: { $regex: query, $options: 'i' } }
            ]
        }).limit(5).select('firstName lastName nickname');

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// User Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        const currentUserId = req.session.user._id;

        // 1. Fetch User with Profile Data & Saved Posts
        // Using .lean() is MANDATORY for Handlebars display
        const userProfile = await User.findById(currentUserId)
            .populate('savedPosts')
            .populate('collections')
            .lean();

        // 2. Fetch Posts Liked by this User
        // Assuming Post model has: likes: [ObjectId]
        const likedPosts = await Post.find({ likes: currentUserId })
            .populate('user') // to show author name
            .lean();

        // 3. Render
        res.render('dashboard', {
            user: userProfile,
            savedPosts: userProfile.savedPosts,
            items: userProfile.collections, // Renaming to avoid conflict if any, but 'collections' is standard
            collections: userProfile.collections,
            likedPosts: likedPosts,
            isDashboard: true,
            onlineCount: res.locals.onlineCount
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.redirect('/');
    }
});

module.exports = router;
