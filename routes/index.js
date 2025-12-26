const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');


// GET / -> Redirect to Feed (All Posts)
// GET / -> Redirect to Feed (All Posts)
router.get('/', (req, res) => {
    res.redirect('/feed');
});



// GET /feed -> "ALL POSTS" PAGE (The Global Stream)
router.get('/feed', async (req, res) => {
    try {
        let posts = await Post.find().populate('user').lean();
        const user = req.session.user ? await User.findById(req.session.user._id).lean() : null;

        // 1. Kullanıcı varsa ve ilgi alanları (puanları) varsa sıralamaya başla
        if (user && user.interests && Object.keys(user.interests).length > 0) {
            const scores = user.interests;

            posts.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;

                // TAG AYIKLAMA FONKSİYONU (En Güvenli Yol)
                const extractTags = (item) => {
                    if (!item.tags) return [];
                    if (Array.isArray(item.tags)) return item.tags;
                    if (typeof item.tags === 'string') return item.tags.split(',').map(t => t.trim());
                    return [];
                };

                // A Postu için toplam puanı hesapla
                extractTags(a).forEach(tag => {
                    const cleanTag = tag.toLowerCase();
                    scoreA += (scores[cleanTag] || 0);
                });

                // B Postu için toplam puanı hesapla
                extractTags(b).forEach(tag => {
                    const cleanTag = tag.toLowerCase();
                    scoreB += (scores[cleanTag] || 0);
                });

                // SIRALAMA: Puanı yüksek olan üste (Puan farkı varsa)
                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }

                // Puanlar eşitse en yeni olan üste
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } else {
            // Fallback sort if no user/interests
            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        res.render('feed', {
            posts,
            user: req.session.user // Layout için orijinal session bilgisini gönder
        });
    } catch (err) {
        console.error("Sorting Error:", err);
        res.redirect('/');
    }
});

// GET /dashboard -> "MY DASHBOARD" (Profile & Personal Stuff)
router.get('/dashboard', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        // 1. Fetch User with Deep Population
        const user = await User.findById(req.session.user._id)
            .populate('likedPosts')
            .populate({
                path: 'collections',
                populate: { path: 'posts' } // Get posts inside folders for preview/count
            })
            .lean();

        // 2. Process Liked Posts (Filter out deleted posts)
        const likedPosts = (user.likedPosts || []).filter(p => p !== null);

        // 3. Process Collections (The Folder Logic)
        const processedCollections = (user.collections || []).map(col => {
            const validPosts = (col.posts || []).filter(p => p !== null);
            return {
                ...col,
                postCount: validPosts.length,
                // Latest added post image is the folder cover
                coverImage: validPosts.length > 0 ? validPosts[validPosts.length - 1].image : '/img/empty-folder.jpg'
            };
        });

        res.render('dashboard', {
            title: 'My Dashboard',
            user,
            likedPosts,
            collections: processedCollections
        });
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
        res.redirect('/feed');
    }
});

module.exports = router;
