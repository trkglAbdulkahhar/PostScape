const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

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
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user')
            .sort({ createdAt: -1 })
            .lean();

        res.render('admin/panel', {
            posts,
            onlineCount: res.locals.onlineCount,
            title: 'Admin Dashboard'
        });
    } catch (err) {
        console.error("Admin Panel Hatası:", err);
        res.redirect('/');
    }
});

/**
 * 📝 POST EDIT - GET & POST
 */
router.get('/posts/edit/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('user').lean();
        if (!post) return res.redirect('/admin');

        res.render('admin/edit-post', {
            layout: 'main',
            title: 'Admin: Edit Post',
            post
        });
    } catch (err) { res.redirect('/admin'); }
});

router.post('/posts/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/admin');

        if (req.file) {
            // Eski resmi sunucudan sil
            if (post.image) {
                const oldPath = path.join(__dirname, '..', 'public', post.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            post.image = `/uploads/${req.file.filename}`;
        }

        post.title = req.body.title;
        post.body = req.body.body;
        await post.save();

        res.redirect('/admin');
    } catch (err) { res.redirect('/admin'); }
});

/**
 * 🗑️ POST DELETE
 */
router.post('/delete/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (post) {
            // 1. Kullanıcıların 'kaydedilenler' listesinden bu postu çıkar
            await User.updateMany(
                { savedPosts: postId },
                { $pull: { savedPosts: postId } }
            );

            // 2. Resmi fiziksel olarak sil
            if (post.image) {
                const absPath = path.join(__dirname, '..', 'public', post.image);
                if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
            }

            // 3. Postu sil
            await Post.findByIdAndDelete(postId);
        }
        res.redirect('/admin');
    } catch (err) { res.redirect('/admin'); }
});

/**
 * 💬 GLOBAL CHAT MONITORING
 */
router.get('/messages', async (req, res) => {
    try {
        const allConversations = await Conversation.find()
            .populate('members', 'name email')
            .sort({ updatedAt: -1 })
            .lean();

        const activeConversations = [];

        for (const conv of allConversations) {
            const msgCount = await Message.countDocuments({ conversationId: conv._id });
            if (msgCount > 0) {
                const lastMsg = await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 });
                if (lastMsg) conv.lastMessage = lastMsg.text || '[Medya Mesajı]';
                activeConversations.push(conv);
            } else {
                // Mesajı olmayan boş konuşmaları temizle (Ghost Chats)
                await Conversation.findByIdAndDelete(conv._id);
            }
        }

        res.render('admin/messages', {
            title: 'Global Chat Monitor',
            conversations: activeConversations
        });
    } catch (err) { res.redirect('/admin'); }
});

/**
 * 📄 CHAT DETAIL (Transcript)
 */
router.get('/messages/:id', async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('members', 'name')
            .lean();

        const messages = await Message.find({ conversationId: req.params.id })
            .populate('sender', 'name')
            .populate('sharedPost')
            .sort({ createdAt: 1 })
            .lean();

        let viewAsId = messages.length > 0 ? messages[0].sender._id.toString() : null;

        res.render('admin/chat-detail', {
            title: 'Chat Transcript',
            conversation,
            messages,
            viewAsId
        });
    } catch (err) { res.redirect('/admin/messages'); }
});

module.exports = router;                                                                                                                                                                                                        