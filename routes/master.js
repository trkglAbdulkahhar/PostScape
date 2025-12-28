const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

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
router.get('/', masterController.getMasterPanel);

// POST /master/role -> Change User Role
router.post('/role', masterController.updateUserRole);

module.exports = router;
