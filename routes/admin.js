const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const upload = require('../middleware/upload');

// Middleware: Allow Admin & Owner
router.use((req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'owner')) {
        next();
    } else {
        res.redirect('/');
    }
});

// GET /admin -> List All Posts
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find().populate('user').sort({ createdAt: -1 }).lean();
        res.render('admin/panel', { posts, onlineCount: res.locals.onlineCount });
    } catch (err) { console.error(err); res.redirect('/'); }
});

// GET /admin/posts/edit/:id -> Show Admin Edit Form
router.get('/posts/edit/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('user').lean();
        if (!post) return res.redirect('/admin');

        res.render('admin/edit-post', {
            layout: 'main',
            title: 'Admin: Edit Post',
            post
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// POST /admin/posts/edit/:id -> Process Admin Edit
router.post('/posts/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/admin');

        // 1. If new image is uploaded, clean up the old one
        if (req.file) {
            if (post.image) {
                const fs = require('fs');
                const path = require('path');
                const oldPath = path.join(__dirname, '..', 'public', post.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            post.image = `/uploads/${req.file.filename}`;
        }

        // 2. Update text fields
        post.title = req.body.title;
        post.body = req.body.body;

        await post.save();
        res.redirect('/admin'); // Redirect back to Admin Panel
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

const User = require('../models/User'); // Added User model

// POST /admin/delete/:id -> Delete Post
router.post('/delete/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (post) {
            // 1. CLEANUP: Remove from all saved lists
            await User.updateMany(
                { savedPosts: postId },
                { $pull: { savedPosts: postId } }
            );

            // 2. FILE CLEANUP
            if (post.image) {
                const fs = require('fs');
                const path = require('path');
                // Assuming image is stored in public/uploads and path starts with /uploads/
                const absPath = path.join(__dirname, '..', 'public', post.image);
                if (fs.existsSync(absPath)) {
                    fs.unlinkSync(absPath);
                    console.log("Admin: Deleted orphan image:", post.image);
                }
            }

            // 3. DELETE POST
            await Post.findByIdAndDelete(postId);
        }

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// GET /admin/messages/cleanup -> Delete conversations with 0 messages
router.get('/messages/cleanup', async (req, res) => {
    try {
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');

        // 1. Get all conversations
        const allConversations = await Conversation.find();
        let deletedCount = 0;

        // 2. Check each one
        for (const conv of allConversations) {
            // Count messages in this conversation
            const messageCount = await Message.countDocuments({ conversationId: conv._id });

            // 3. If empty, delete the conversation document
            if (messageCount === 0) {
                await Conversation.findByIdAndDelete(conv._id);
                deletedCount++;
            }
        }

        console.log(`🧹 Cleanup Complete: Deleted ${deletedCount} empty conversations.`);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">Cleanup Successful!</h1>
                <p>Deleted <strong>${deletedCount}</strong> empty conversation(s).</p>
                <a href="/admin/messages" style="display: inline-block; padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px;">Back to Monitor</a>
            </div>
        `);

    } catch (err) {
        console.error("Cleanup Error:", err);
        res.send("Error during cleanup.");
    }
});

// GET /admin/messages -> List ONLY Active Conversations (Auto-Clean Ghosts)
router.get('/messages', async (req, res) => {
    try {
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');

        // 1. Fetch all potential conversations
        const allConversations = await Conversation.find()
            .populate('members', 'name email')
            .sort({ updatedAt: -1 })
            .lean();

        const activeConversations = [];

        // 2. Filter & Clean Loop
        for (const conv of allConversations) {
            // Check real message count in DB
            const msgCount = await Message.countDocuments({ conversationId: conv._id });

            if (msgCount > 0) {
                // It's a real chat, keep it
                // Optional: Update the lastMessage preview with the actual last message text
                const lastMsg = await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 });
                if (lastMsg) {
                    conv.lastMessage = lastMsg.text || '[Shared Post]';
                }
                activeConversations.push(conv);
            } else {
                // It's a GHOST/EMPTY chat -> Kill it immediately
                await Conversation.findByIdAndDelete(conv._id);
                console.log(`👻 Auto-deleted ghost conversation: ${conv._id}`);
            }
        }

        // 3. Render only the active ones
        res.render('admin/messages', {
            title: 'Global Chat Monitor',
            conversations: activeConversations
        });

    } catch (err) {
        console.error("Admin Messages Error:", err);
        res.redirect('/admin');
    }
});

// GET /admin/messages/:id -> Read a Specific Transcript
router.get('/messages/:id', async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('members', 'name')
            .lean();

        const messages = await Message.find({ conversationId: req.params.id })
            .populate('sender', 'name') // See who sent what
            .populate('sharedPost')     // See if they shared a post
            .sort({ createdAt: 1 })
            .lean();

        // LOGIC: Set the "Viewpoint" to the sender of the very first message.
        // If no messages, default to the first member.
        let viewAsId = null;
        if (messages.length > 0) {
            viewAsId = messages[0].sender._id.toString();
        } else if (conversation.members.length > 0) {
            viewAsId = conversation.members[0]._id.toString();
        }

        res.render('admin/chat-detail', {
            title: 'Chat Transcript',
            conversation,
            messages,
            viewAsId // <--- PASS THIS ID
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/messages');
    }
});

module.exports = router;
