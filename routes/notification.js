const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// 1. Mark all valid notifications as read
router.post('/mark-all-read', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false });

        await Notification.updateMany(
            { recipient: req.session.user._id, read: false }, // 'read' seems to be the field based on partial usage
            { $set: { read: true } }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Mark Read Error:", err);
        res.status(500).json({ success: false });
    }
});

// 2. Delete all notifications
router.post('/delete-all', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false });

        await Notification.deleteMany({ recipient: req.session.user._id });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete All Error:", err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
