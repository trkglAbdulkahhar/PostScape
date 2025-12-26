const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Middleware: Require Login
router.use((req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
});

// GET /messages
router.get('/', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');

        // 1. Get all conversations for the left pane
        const conversations = await Conversation.find({
            members: { $in: [req.session.user._id] }
        }).populate('members', 'name').sort({ updatedAt: -1 }).lean();

        let messages = [];
        let activeChat = null;
        const activeChatId = req.query.id; // Switch chat based on URL ID

        // 2. If a chat is selected, get its messages
        if (activeChatId) {
            activeChat = await Conversation.findById(activeChatId).populate('members', 'name').lean();
            if (activeChat) {
                messages = await Message.find({ conversationId: activeChatId })
                    .populate('sender', 'name')
                    .sort({ createdAt: 1 })
                    .lean();
            }
        }

        res.render('messages/inbox', {
            conversations,
            messages,
            activeChatId,
            activeChat,
            hasConversations: conversations.length > 0,
            user: req.session.user
        });
    } catch (err) {
        console.error("Inbox Error:", err);
        res.redirect('/dashboard');
    }
});

// GET /messages/t/:userId -> START/OPEN CHAT
router.get('/t/:userId', async (req, res) => {
    try {
        const myId = req.session.user._id;
        const targetId = req.params.userId;

        // Check if conversation exists
        let conversation = await Conversation.findOne({
            members: { $all: [myId, targetId] }
        });

        // If not, create one
        if (!conversation) {
            conversation = await Conversation.create({
                members: [myId, targetId],
                lastMessage: 'Chat started'
            });
        }

        // Redirect to the chat view
        res.redirect(`/messages/${conversation._id}`);
    } catch (err) {
        console.error(err);
        res.redirect('/messages');
    }
});

// GET /messages/new -> Show the "Compose Message" form
// MUST BE BEFORE router.get('/:id')
router.get('/new', (req, res) => {
    res.render('messages/new', { title: 'New Message' });
});

// POST /messages/new -> Find User & Start Chat
router.post('/new', async (req, res) => {
    try {
        const { username, text, recipientId } = req.body;
        const myId = req.session.user._id;

        let targetUser;

        // 1. Try finding by ID first (from Autocomplete)
        if (recipientId) {
            targetUser = await User.findById(recipientId);
        }
        // 2. Fallback to Username search
        else if (username) {
            targetUser = await User.findOne({
                name: { $regex: new RegExp(`^${username}$`, 'i') }
            });
        }

        // Validation Checks
        if (!targetUser) {
            return res.render('messages/new', {
                error: 'User not found! Please check the name.',
                username,
                text
            });
        }

        if (targetUser._id.toString() === myId) {
            return res.render('messages/new', {
                error: 'You cannot message yourself.',
                username,
                text
            });
        }

        // 3. Find or Create Conversation
        let conversation = await Conversation.findOne({
            members: { $all: [myId, targetUser._id] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                members: [myId, targetUser._id],
                lastMessage: text
            });
        } else {
            // Update existing conversation
            conversation.lastMessage = text;
            conversation.lastMessageDate = Date.now();
            await conversation.save();
        }

        // 4. Save the Message
        await Message.create({
            conversationId: conversation._id,
            sender: myId,
            text: text
        });

        // 5. Redirect to the Chat Room
        res.redirect(`/messages/${conversation._id}`);

    } catch (err) {
        console.error(err);
        res.render('messages/new', { error: 'An error occurred.' });
    }
});

// GET /messages/:conversationId -> VIEW CHAT ROOM (Redirect to Split View)
router.get('/:id', (req, res) => {
    // Enforce split-screen by redirecting to the query param format
    res.redirect('/messages?id=' + req.params.id);
});

// POST /messages/share -> Share a post to a user
router.post('/share', async (req, res) => {
    try {
        const { recipientId, postId, text } = req.body;
        const senderId = req.session.user._id;

        // 1. Find or Create Conversation
        let conversation = await Conversation.findOne({
            members: { $all: [senderId, recipientId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                members: [senderId, recipientId],
                lastMessage: 'Shared a post'
            });
        }

        // 2. Create Message with Shared Post
        await Message.create({
            conversationId: conversation._id,
            sender: senderId,
            text: text || '', // Optional text
            sharedPost: postId
        });

        // 3. Update Conversation Metadata
        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: `Shared a post`,
            lastMessageDate: Date.now()
        });

        // Redirect back to where the user was (Feed or Post)
        res.redirect('back');

    } catch (err) {
        console.error("Share Error:", err);
        res.redirect('back');
    }
});

// POST /messages/:id -> SEND MESSAGE
// POST /messages/:id -> SEND MESSAGE
router.post('/:id', async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { text } = req.body;

        // 1. Save Message
        // Using explicit Mongoose model creation as per request style, or cleaner create
        const senderId = req.session.user._id;

        const newMessage = new Message({
            conversationId: conversationId,
            sender: senderId,
            text: text
        });
        await newMessage.save();

        // 2. Update Conversation Metadata (Last message info & updatedAt for sorting)
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: text,
            lastMessageDate: Date.now(),
            updatedAt: Date.now() // Explicitly update this for sorting
        });

        // 3. Redirect to the Split-Screen View with ID
        res.redirect(`/messages?id=${conversationId}`);

    } catch (err) {
        console.error("Send Message Error:", err);
        res.redirect('/messages');
    }
});

// POST /messages/delete/:id
// 1. DELETE MESSAGE
router.post('/delete-message/:id', async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.sender.toString() !== req.session.user._id.toString()) {
            return res.redirect('back');
        }
        const conversationId = message.conversationId;
        await Message.findByIdAndDelete(req.params.id);

        // Redirect to split-pane view
        res.redirect(`/messages?id=${conversationId}`);
    } catch (err) {
        console.error("Delete Error:", err);
        res.redirect('/messages');
    }
});

// 2. EDIT MESSAGE (POST)
router.post('/edit-message/:id', async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.sender.toString() !== req.session.user._id.toString()) {
            return res.redirect('back');
        }
        message.text = req.body.text;
        await message.save();

        // Redirect to split-pane view
        res.redirect(`/messages?id=${message.conversationId}`);
    } catch (err) {
        console.error("Edit Error:", err);
        res.redirect('/messages');
    }
});

module.exports = router;
