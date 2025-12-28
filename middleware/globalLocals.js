const mongoose = require('mongoose');

module.exports = async (req, res, next) => {
    res.locals.user = null;
    res.locals.currentUser = null;
    res.locals.isAdmin = false;
    res.locals.isMaster = false;
    res.locals.collections = [];
    res.locals.savedPostIds = [];
    res.locals.onlineCount = 1;

    if (req.session?.user) {
        try {
            const User = mongoose.model('User');
            const user = await User.findById(req.session.user._id).lean();

            if (!user) {
                req.session.destroy();
                return next();
            }

            res.locals.user = user;
            res.locals.currentUser = user;

            // Role sync
            if (req.session.user.role !== user.role) {
                req.session.user.role = user.role;
                req.session.save();
            }

            res.locals.isAdmin = ['admin', 'owner'].includes(user.role);
            res.locals.isMaster = user.role === 'owner';

            await User.findByIdAndUpdate(user._id, { lastActive: new Date() });

            // Collections
            const Collection = mongoose.model('Collection');
            const collections = await Collection.find({ user: user._id }).lean();
            res.locals.collections = collections;

            if (collections?.length) {
                res.locals.savedPostIds = collections.flatMap(c =>
                    c.posts.map(p => p.toString())
                );
            }

            // Notifications
            const Notification = require('../models/Notification');
            res.locals.notifications = await Notification
                .find({ recipient: user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('sender', 'name image')
                .lean();

            res.locals.unreadCount = await Notification.countDocuments({
                recipient: user._id,
                read: false
            });

            // Recent Contacts (Chat List in Share Modal)
            try {
                // Try to get model, or require it if not registered
                const Conversation = mongoose.models.Conversation || require('../models/Conversation');

                const recentConvos = await Conversation.find({ members: user._id })
                    .populate('members', 'name')
                    .sort({ updatedAt: -1 })
                    .lean();

                res.locals.recentContacts = recentConvos.map(c => {
                    const other = c.members.find(m => m._id.toString() !== user._id.toString());
                    return {
                        _id: other ? other._id : null,
                        name: other ? other.name : 'Unknown User',
                        conversationId: c._id
                    };
                }).filter(c => c._id);
            } catch (err) {
                console.error("Recent Contacts Error:", err);
                res.locals.recentContacts = [];
            }

        } catch (err) {
            console.error('GlobalLocals Error:', err);
        }
    }

    // 4. ONLINE COUNT (Global)
    try {
        const User = mongoose.model('User');
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const count = await User.countDocuments({ lastActive: { $gte: fiveMinAgo } });
        res.locals.onlineCount = count;

        // NEW: Total Visitor Count (For Footer & Admin)
        const totalUsers = await User.countDocuments({});
        res.locals.totalUsers = totalUsers;

    } catch (e) { console.error(e); }

    next();
};
