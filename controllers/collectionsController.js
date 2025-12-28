const Collection = require('../models/Collection');
const Post = require('../models/Post');
const User = require('../models/User');

// POST /collections/save -> Toggle Save (Add or Remove)
exports.saveCollection = async (req, res) => {
    try {
        const { postId, collectionId, newCollectionName } = req.body;
        const userId = req.session.user._id;

        const user = await User.findById(userId);

        // Robust check: Is this post already in the user's saved list?
        const isAlreadySaved = user.savedPosts.some(id => id.toString() === postId);

        if (isAlreadySaved) {
            // --- 1. UNSAVE OPERATION (Batch Optimized) ---

            // A. Remove from User's Global List
            await User.findByIdAndUpdate(userId, { $pull: { savedPosts: postId } });

            // B. Remove this post from ALL the user's collections
            await Collection.updateMany(
                { _id: { $in: user.collections } },
                { $pull: { posts: postId } }
            );

            // C. CRITICAL: Find and Delete Empty Collections
            const emptyCollections = await Collection.find({
                _id: { $in: user.collections },
                posts: { $size: 0 }
            });

            if (emptyCollections.length > 0) {
                const emptyIds = emptyCollections.map(c => c._id);

                // Delete from DB
                await Collection.deleteMany({ _id: { $in: emptyIds } });

                // Remove from User's profile
                await User.findByIdAndUpdate(userId, {
                    $pull: { collections: { $in: emptyIds } }
                });

                console.log(`🧹 Empty collections cleaned: ${emptyIds.length}`);
            }

            return res.redirect(req.get('Referrer') || '/');
        }

        // --- 2. SAVE OPERATION ---
        let targetCollectionId;

        if (newCollectionName) {
            // Create New Collection
            const targetCollection = await Collection.create({
                name: newCollectionName,
                user: userId,
                posts: [postId]
            });
            targetCollectionId = targetCollection._id;
        } else if (collectionId) {
            // Use Existing Collection
            await Collection.findByIdAndUpdate(collectionId, { $addToSet: { posts: postId } });
            targetCollectionId = collectionId;
        } else {
            // Fallback: If no collection selected, maybe just save to global? 
            // For now, redirect if no collection info provided
            return res.redirect(req.get('Referrer') || '/');
        }

        // Update User Global List & Collections List
        if (targetCollectionId) {
            await User.findByIdAndUpdate(userId, {
                $addToSet: {
                    collections: targetCollectionId,
                    savedPosts: postId
                }
            });
        }

        // Update Cover Image if needed
        const post = await Post.findById(postId);
        if (post && post.image) {
            await Collection.findByIdAndUpdate(targetCollectionId, { coverImage: post.image });
        }

        res.redirect(req.get('Referrer') || '/');
    } catch (err) {
        console.error("Collection Toggle Error:", err);
        res.redirect(req.get('Referrer') || '/');
    }
};

// GET /collections/:id -> View Single Collection (The Posts inside)
exports.getCollection = async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id)
            .populate({
                path: 'posts',
                populate: { path: 'user' } // Populate authors of posts
            })
            .lean();

        if (!collection) return res.render('error', { message: 'Folder not found' });

        res.render('collections/view', {
            title: collection.name,
            collection,
            user: req.session.user
        });
    } catch (err) {
        console.error(err);
        res.render('error');
    }
};
