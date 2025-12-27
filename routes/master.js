const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.use((req, res, next) => {
    const role = req.session.user ? req.session.user.role : null;
    // Artık hem admin hem owner girebilecek
    if (role === 'owner' || role === 'admin') {
        next();
    } else {
        console.warn("Yetkisiz Master Girişi:", req.session.user?._id);
        res.redirect('/user/dashboard');
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
