const User = require('../models/User');
const Notification = require('../models/Notification');

// GET - User Search API for Autocomplete
exports.searchUsers = async (req, res) => {
    const query = req.query.query;
    if (!query || query.length < 1) return res.json([]);

    try {
        // DATA-DRIVEN FILTERING: Fetch fresh following list
        const currentUser = await User.findById(req.session.user._id).select('following');
        const followingIds = currentUser.following || [];

        // Fail-Safe: If not following anyone, return empty
        if (followingIds.length === 0) return res.json([]);

        // CONSTRAINT: Only search within following list
        const users = await User.find({
            _id: { $in: followingIds },
            $or: [
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } },
                { nickname: { $regex: query, $options: 'i' } },
                { name: { $regex: query, $options: 'i' } }
            ]
        }).limit(10).select('firstName lastName nickname name image');

        res.json(users);
    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).json([]);
    }
};

// Toggle Follow / Unfollow User (Instant - No Request)
exports.toggleFollow = async (req, res) => {
    try {
        const targetId = req.params.id;
        const selfId = req.session.user._id;

        if (targetId === selfId.toString()) return res.json({ success: false, msg: "Kendini takip edemezsin." });

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ success: false });

        // Check if already following (Toggle Logic)
        const isFollowing = targetUser.followers.includes(selfId);

        if (isFollowing) {
            // UNFOLLOW
            await User.findByIdAndUpdate(targetId, { $pull: { followers: selfId } });
            await User.findByIdAndUpdate(selfId, { $pull: { following: targetId } });
            return res.json({ success: true, status: 'unfollowed' });
        } else {
            // FOLLOW (Instant)
            // 1. Karşılıklı güncelleme (Takip eden ve Edilen)
            await User.findByIdAndUpdate(selfId, { $addToSet: { following: targetId } });
            await User.findByIdAndUpdate(targetId, { $addToSet: { followers: selfId } });

            // 2. Bildirim Gönder (Notification System)
            await Notification.create({
                recipient: targetId,
                sender: selfId,
                type: 'follow',
                content: 'seni takip etmeye başladı.'
            });

            return res.json({ success: true, status: 'following' });
        }

    } catch (err) {
        console.error("Follow Error:", err);
        res.status(500).json({ success: false });
    }
};

// TAKİPÇİLER SAYFASI
exports.getFollowers = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id)
            .populate('followers', 'name nickname role')
            .lean();

        if (!targetUser) return res.redirect('/dashboard');

        res.render('user/social-list', {
            title: 'Followers',
            list: targetUser.followers,
            targetName: targetUser.firstName + ' ' + targetUser.lastName,
            currentUser: req.session.user,
            isFollowersPage: true // FLAG for UI
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

// TAKİP EDİLENLER SAYFASI
exports.getFollowing = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id)
            .populate('following', 'name nickname role')
            .lean();

        if (!targetUser) return res.redirect('/dashboard');

        res.render('user/social-list', {
            title: 'Following',
            list: targetUser.following,
            targetName: targetUser.firstName + ' ' + targetUser.lastName,
            currentUser: req.session.user,
            isFollowersPage: false // FLAG for UI
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

// POST /user/remove-follower/:id
exports.removeFollower = async (req, res) => {
    try {
        const followerId = req.params.id; // Beni takip eden kişi
        const myId = req.session.user._id; // Ben

        // 1. O kişinin 'following' listesinden beni çıkart
        await User.findByIdAndUpdate(followerId, { $pull: { following: myId } });
        // 2. Benim 'followers' listemden o kişiyi çıkart
        await User.findByIdAndUpdate(myId, { $pull: { followers: followerId } });

        res.json({ success: true, status: 'removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};
