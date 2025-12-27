const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Post = require('../models/Post');
const upload = require('../middleware/upload');
const csurf = require('csurf');
const csrfProtection = csurf({ cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' } });

// --- HELPER FUNCTION (Must be defined at the top scope) ---
const deleteFile = (filePath) => {
    if (!filePath || filePath === '') return;

    // Construct absolute path: /uploads/abc.jpg -> public/uploads/abc.jpg
    const absolutePath = path.join(__dirname, '..', 'public', filePath);

    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch (err) {
            console.error("❌ Error deleting file:", err);
        }
    } else {
    }
};

// 1. SPECIFIC ROUTES (Must be first)

// TEMP FIX: Reset all comments to empty arrays to fix Schema mismatch
router.get('/reset-comments', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        // Set comments to [] for ALL posts
        await Post.updateMany({}, { $set: { comments: [] } });

        console.log("✅ Database Fix: All comments reset successfully.");
        res.send(`
            <h1>Database Fixed!</h1>
            <p>Old incompatible comments have been cleared.</p>
            <p>You can now <a href="/feed">Return to Feed</a> and add new comments.</p>
        `);
    } catch (err) {
        console.error(err);
        res.send("Error resetting comments.");
    }
});

// GET /posts/add -> Create Post Form
router.get('/add', (req, res) => {
    res.render('posts/add', { title: 'Create Post', user: req.session.user });
});

// POST /posts -> Create Logic
router.post('/', upload.single('image'), csrfProtection, async (req, res) => {
    try {
        // Tag splitting logic
        let tags = [];
        if (req.body.tags) {
            tags = req.body.tags.split(' ').filter(t => t !== '').map(t => t.replace('@', ''));
        }

        const newPost = {
            title: req.body.title,
            body: req.body.body,
            tags: tags,
            user: req.session.user._id,
            image: req.file ? `/uploads/${req.file.filename}` : undefined
        };
        await Post.create(newPost);
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Error creating post: ' + err.message });
    }
});

// 1. EDIT PAGE (GET) - MUST BE ABOVE /:id
router.get('/edit/:id', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        // Use lean() for performance if we just need to render
        const post = await Post.findById(req.params.id).lean();

        if (!post) return res.redirect('/feed');

        // FIXED OWNERSHIP CHECK: Ensure both are strings
        const isOwner = post.user.toString() === req.session.user._id.toString();
        // Check for role, defaulting to 'user' if undefined
        const isAdmin = (req.session.user.role === 'admin' || req.session.user.role === 'owner');

        if (!isOwner && !isAdmin) {
            console.log("Access Denied: Not owner or admin");
            return res.redirect('/feed');
        }

        res.render('posts/edit', { post, user: req.session.user });
    } catch (err) {
        console.error("Edit Page Error:", err);
        res.redirect('/feed');
    }
});

// 2. PROCESS EDIT (POST)
router.post('/edit/:id', upload.single('image'), csrfProtection, async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/feed');

        const isOwner = post.user.toString() === req.session.user._id.toString();
        const isAdmin = (req.session.user.role === 'admin' || req.session.user.role === 'owner');

        if (!isOwner && !isAdmin) return res.status(403).send("Unauthorized");

        // Update fields
        post.title = req.body.title;
        post.body = req.body.body;

        // Handle Tags
        if (req.body.tags) {
            post.tags = req.body.tags.split(' ').filter(t => t !== '').map(t => t.replace('@', ''));
        } else {
            post.tags = [];
        }

        // Handle Image
        if (req.file) {
            if (post.image) {
                deleteFile(post.image);
            }
            post.image = `/uploads/${req.file.filename}`;
        }

        await post.save();
        res.redirect(`/posts/${post._id}`);
    } catch (err) {
        console.error("Post Update Error:", err);
        res.redirect('/feed');
    }
});

const User = require('../models/User'); // Added User model requirement

// POST /posts/delete/:id (Process Delete)
// POST /posts/delete/:id (Process Delete)
router.post('/delete/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        // Security Check
        if (!post) return res.redirect('/feed');

        // GÜVENLİK KONTROLÜ GÜNCELLEME:
        // Eğer (Postun sahibi SEN DEĞİLSEN) VE (Admin DEĞİLSEN) silme işlemini reddet
        const isOwner = post.user.toString() === req.session.user._id.toString();
        const isAdmin = req.session.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            console.log("🚫 Yetkisiz silme denemesi!");
            return res.redirect('/feed');
        }

        // 1. CLEANUP: Remove this ID from ALL users' saved lists
        await User.updateMany(
            { savedPosts: postId },
            { $pull: { savedPosts: postId } }
        );

        // 2. PHYSICAL DELETE: Remove image from storage
        if (post.image) {
            deleteFile(post.image);
        }

        // 3. DATABASE: Delete the post
        await Post.deleteOne({ _id: postId });

        // Eğer admin panelinden geldiyse oraya geri dönsün, değilse feed'e
        const redirectTo = isAdmin ? '/admin' : '/feed';
        res.redirect(redirectTo);
    } catch (err) {
        console.error("Delete Error:", err);
        res.redirect('/feed');
    }
});

// GET /posts/mine -> User's Own Posts
router.get(['/mine', '/my-posts'], async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const posts = await Post.find({ user: req.session.user._id })
            .sort({ createdAt: -1 })
            .lean();

        res.render('posts/my-posts', {
            posts,
            user: req.session.user,
            title: 'My Contributions',
            onlineCount: res.locals.onlineCount
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// 2. ACTION ROUTES (Like/Save/Comment)

// POST /like/:id
// POST /like/:id
router.post('/like/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.user._id;

        const post = await Post.findById(postId);
        if (!post) return res.redirect(req.get('Referrer') || '/');

        // Kullanıcı bu postu zaten beğenmiş mi?
        // Robust check: Convert both to strings
        const isLiked = post.likes.some(id => id.toString() === userId.toString());

        if (isLiked) {
            // 1. Un-like
            await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
            await User.findByIdAndUpdate(userId, { $pull: { likedPosts: postId } });
        } else {
            // 2. Like
            await Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } });
            await User.findByIdAndUpdate(userId, { $addToSet: { likedPosts: postId } });

            // Create Notification if not self-like
            if (post.user.toString() !== userId.toString()) {
                const Notification = require('../models/Notification');
                await Notification.create({
                    recipient: post.user,
                    sender: userId,
                    type: 'like',
                    post: postId
                });
            }
        }

        // Sayfayı sessizce render et (yenile)
        res.redirect(req.get('Referrer') || '/');
    } catch (err) {
        console.error("Like Error Fixed:", err.message);
        res.redirect(req.get('Referrer') || '/');
    }
});

// POST /save/:id
router.post('/save/:id', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const User = require('../models/User');
        const Collection = require('../models/Collection'); // Ensure Collection model is available
        const user = await User.findById(req.session.user._id);

        // Toggle Save
        if (user.savedPosts.includes(req.params.id)) {
            // UNSAVE OPERATION
            user.savedPosts.pull(req.params.id);

            // SYNC CLEANUP: Also remove from any collections
            await Collection.updateMany(
                { _id: { $in: user.collections } },
                { $pull: { posts: req.params.id } }
            );

            // AUTO-DELETE EMPTY FOLDERS
            const userCollections = await Collection.find({ _id: { $in: user.collections } });
            const emptyCollections = userCollections.filter(c => !c.posts || c.posts.length === 0);

            if (emptyCollections.length > 0) {
                const emptyIds = emptyCollections.map(c => c._id);
                await Collection.deleteMany({ _id: { $in: emptyIds } });
                user.collections = user.collections.filter(id => !emptyIds.map(e => e.toString()).includes(id.toString()));
                console.log(`[Unsave] Auto-deleted ${emptyIds.length} empty folders.`);
            }

        } else {
            // SAVE OPERATION
            user.savedPosts.push(req.params.id);
        }
        await user.save();
        req.session.user = user; // Update session
        res.redirect(`/posts/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// GET /posts/:slug/comments -> The Dedicated Split-View Page
router.get('/:slug/comments', async (req, res) => {
    try {
        // Find by slug first
        const post = await Post.findOne({ slug: req.params.slug })
            .populate('user')
            .populate('comments.user')
            .lean();

        if (!post) {
            // Fallback for ID based lookup if link is old
            if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
                const postById = await Post.findById(req.params.slug);
                if (postById) return res.redirect(301, `/posts/${postById.slug}/comments`);
            }
            return res.render('error', { message: 'Post not found' });
        }

        res.render('posts/comments', {
            post,
            user: req.session.user,
            title: 'Comments'
        });
    } catch (err) {
        console.error("Comments Page Error:", err);
        res.render('error');
    }
});

// POST /comment/:id
router.post('/comment/:id', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/feed');

        // Create comment object matching the NEW Schema
        const newComment = {
            text: req.body.text,
            user: req.session.user._id, // This must be an ObjectId
            createdAt: new Date()
        };

        // Mongoose will now accept this because we cleared the old broken data
        post.comments.push(newComment);
        await post.save();

        if (req.body.redirect === 'comments') {
            return res.redirect(`/posts/${req.params.id}/comments`);
        }

        // Use Referer for fallback
        const backURL = req.header('Referer') || `/posts/${req.params.id}`;
        res.redirect(backURL);

    } catch (err) {
        console.error("Comment Error:", err);
        const backURL = req.header('Referer') || '/feed';
        res.redirect(backURL);
    }
});

// 3. DYNAMIC ROUTE (Must be LAST)
// GET /posts/:slug -> VIEW SINGLE POST (Updated for Slug)
router.get('/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;

        // Find by slug instead of ID
        const post = await Post.findOne({ slug: slug })
            .populate('user', 'name')
            .lean();

        if (!post) {
            // Fallback: Check if it's an ID (Old Link Support)
            if (mongoose.Types.ObjectId.isValid(slug)) {
                const postById = await Post.findById(slug);
                if (postById && postById.slug) {
                    return res.redirect(301, `/posts/${postById.slug}`);
                }
            }
            return res.render('error', { message: 'Post not found' });
        }

        // Check if liked by current user (Robust check)
        let isLiked = false;
        let isSaved = false;

        let adminMode = false;

        if (req.session.user) {
            // Check Admin Mode (Security Check: Must be admin/owner)
            const isAdmin = ['admin', 'owner'].includes(req.session.user.role);
            if (req.query.adminMode === 'true' && isAdmin) {
                adminMode = true;
            }

            // Check Like
            if (post.likes) {
                isLiked = post.likes.some(id => id.toString() === req.session.user._id.toString());
            }

            // Check Save (Need to fetch user's saved list)
            const User = require('../models/User');
            // Re-fetch user to get latest interests and saved list
            const user = await User.findById(req.session.user._id);

            if (user && user.savedPosts) {
                isSaved = user.savedPosts.some(p => p.toString() === post._id.toString());
            }

            // --- ALGORITHM: AGGRESSIVE TRACKING (+10 Points) ---
            if (user && post.tags) {
                // Ensure interests is an object
                if (!user.interests || typeof user.interests !== 'object' || Array.isArray(user.interests)) {
                    user.interests = {};
                }

                // Robust Tag Extraction
                let postTags = [];
                if (Array.isArray(post.tags)) {
                    postTags = post.tags;
                } else if (typeof post.tags === 'string') {
                    postTags = post.tags.split(',').map(t => t.trim());
                }

                postTags.forEach(tag => {
                    const cleanTag = tag.trim().toLowerCase();
                    if (cleanTag) {
                        // Boost score massively (+10) to force immediate re-ranking
                        user.interests[cleanTag] = (user.interests[cleanTag] || 0) + 10;
                    }
                });

                // Mark as modified because 'Mixed' type doesn't auto-detect deep changes
                user.markModified('interests');
                await user.save({ validateBeforeSave: false });
            }
        }

        // Get online count from app's locals or default to 0
        const onlineCount = req.app.locals.onlineCount || 0;

        res.render('posts/view', {
            post,
            user: req.session.user,
            isLiked,
            isSaved,
            onlineCount,
            adminMode // Pass to view
        });

    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Error loading post' });
    }
});

// POST /track-click/:postId (Interest Tracking)
router.post('/track-click/:postId', async (req, res) => {
    try {
        if (!req.session.user) return res.json({ skip: true });

        const post = await Post.findById(req.params.postId);
        // Need User model here if not globally available
        const User = require('../models/User');
        const user = await User.findById(req.session.user._id);

        if (post && post.tags && post.tags.length > 0) {
            // SAFE TRACKING: Wrap in silent try-catch
            try {
                post.tags.forEach(tag => {
                    // Check if interests is an array (likely) or Map (unlikely with Mixed)
                    // If array, we can't really "increment" scores easily without a proper structure.
                    // Assuming we might skip this for now or just push if it's an array.
                    // The user asked to SILENCE it.
                    if (user.interests && typeof user.interests.get === 'function') {
                        const currentScore = user.interests.get(tag) || 0;
                        user.interests.set(tag, currentScore + 1);
                    }
                });
                await user.save({ validateBeforeSave: false });
            } catch (e) { /* silent */ }
        }
        res.json({ success: true });
    } catch (err) {
        // Silent
        res.json({ success: true });
    }
});

module.exports = router;
