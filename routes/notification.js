const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// 1. Mark all valid notifications as read
router.post('/mark-all-read', notificationController.markAllRead);

// 2. Delete all notifications
router.post('/delete-all', notificationController.deleteAllNotifications);

module.exports = router;
