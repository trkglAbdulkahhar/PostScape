const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');

// Middleware: Require Login
router.use((req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
});

// GET /messages (Root)
router.get(['/', '/inbox'], messagesController.getInbox);

// GET /messages/t/:userId -> START/OPEN CHAT
router.get('/t/:userId', messagesController.startChat);

// GET /messages/new -> Show the "Compose Message" form
// MUST BE BEFORE router.get('/:id')
router.get('/new', messagesController.getCompose);

// POST /messages/new -> Find User & Start Chat
router.post('/new', messagesController.postCompose);

// GET /messages/:identifier -> VIEW CHAT (Supports ID or Nickname)
router.get('/:identifier', messagesController.getChat);

// POST /messages/share -> Share a post to a user
router.post('/share', messagesController.sharePost);

// POST /messages/:id -> SEND MESSAGE
router.post('/:id', messagesController.sendMessage);

// POST /messages/delete-message/:id
router.post('/delete-message/:id', messagesController.deleteMessage);

// 2. EDIT MESSAGE (POST)
router.post('/edit-message/:id', messagesController.editMessage);

module.exports = router;
