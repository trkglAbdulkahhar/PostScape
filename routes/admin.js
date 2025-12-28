const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const adminController = require('../controllers/adminController');

/**
 * 🛡️ ADMIN ACCESS CONTROL
 * Sadece 'admin' veya 'owner' rütbesine sahip olanlar girebilir.
 */
router.use((req, res, next) => {
    const role = req.session.user ? req.session.user.role : null;
    if (role === 'admin' || role === 'owner') {
        next();
    } else {
        console.warn("🚫 Yetkisiz Admin Paneli Giriş Denemesi:", req.session.user?._id);
        res.redirect('/');
    }
});

/**
 * 📊 GET /admin
 * Tüm postları listeler.
 */
router.get('/', adminController.getDashboard);

/**
 * 📝 POST EDIT - GET & POST
 */
router.get('/posts/edit/:id', adminController.getEditPost);
router.post('/posts/edit/:id', upload.single('image'), adminController.updatePost);

/**
 * 🗑️ POST DELETE
 */
router.post('/delete/:id', adminController.deletePost);

/**
 * 💬 GLOBAL CHAT MONITORING
 */
router.get('/messages', adminController.getMessages);

/**
 * 📄 CHAT DETAIL (Transcript)
 */
router.get('/messages/:id', adminController.getChatDetail);

module.exports = router;