const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Middleware: Strict Owner Check
router.use((req, res, next) => {
    // Check if user is logged in AND is owner
    if (req.session.user && req.session.user.role === 'owner') {
        next();
    } else {
        console.warn(`Unauthorized access attempt to Master Panel by user: ${req.session.user ? req.session.user._id : 'Guest'}`);
        res.redirect('/user/dashboard'); // Redirect to their dashboard, not home
    }
});

// GET /master -> List Users (The Panel)
router.get('/', async (req, res) => {
    try {
        // Fetch all users EXCEPT 'owner', sorted by newest
        const users = await User.find({ role: { $in: ['user', 'admin'] } })
            .sort({ createdAt: -1 })
            .lean(); // Mandatory for Handlebars

        res.render('master/panel', {
            users,
            layout: 'main',
            title: 'Master Control Panel'
        });
    } catch (err) {
        console.error("Master Panel Error:", err);
        res.render('error', { message: 'Could not load Master Panel' });
    }
});

// POST /master/role -> Change User Role
router.post('/role', async (req, res) => {
    try {
        const { userId, newRole } = req.body;

        // Security: Prevent assigning 'owner' role
        if (newRole === 'owner') {
            return res.redirect('/master?error=cannot_assign_owner_role');
        }

        // Prevent changing own role (safety mechanism)
        if (userId === req.session.user._id) {
            return res.redirect('/master?error=cannot_change_own_role');
        }

        await User.findByIdAndUpdate(userId, { role: newRole });
        res.redirect('/master');
    } catch (err) {
        console.error(err);
        res.redirect('/master');
    }
});

module.exports = router;
