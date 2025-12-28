const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// --- HELPER: Render Inbox with Active Chat ---
const renderInbox = async (req, res, activeChatId = null) => {
    try {
        const userId = req.session.user._id;

        // 1. Get all conversations
        let conversations = await Conversation.find({
            members: { $in: [userId] }
        }).populate('members', 'name nickname slug image').sort({ updatedAt: -1 }).lean();

        // 2. Pre-process conversations to identify "One-on-One" target
        // This helps the view link to /messages/nickname
        conversations = conversations.map(c => {
            const otherUser = c.members.find(m => m._id.toString() !== userId.toString()) || c.members[0]; // Fallback to self if alone
            return {
                ...c,
                otherUser // Attach for view usage
            };
        });

        let messages = [];
        let activeChat = null;

        if (activeChatId) {
            activeChat = await Conversation.findOne({
                _id: activeChatId,
                members: { $in: [userId] }
            }).populate('members', 'name nickname image').lean();

            if (activeChat) {
                messages = await Message.find({ conversationId: activeChatId })
                    .populate('sender', 'name image')
                    .populate({
                        path: 'sharedPost',
                        populate: { path: 'user', select: 'name' }
                    })
                    .sort({ createdAt: 1 })
                    .lean();
            }
        }

        res.render('messages/inbox', {
            conversations,
            messages,
            activeChatId, // Pass ID for active state checking
            activeChat,
            hasConversations: conversations.length > 0,
            user: req.session.user,
            csrfToken: res.locals.csrfToken // Ensure local is passed explicitly if needed (though global handles it)
        });

    } catch (err) {
        console.error("Inbox Render Error:", err);
        res.redirect('/dashboard');
    }
};

// GET /messages (Root)
exports.getInbox = async (req, res) => {
    // Support legacy query param ?id=...
    const queryId = req.query.id;
    await renderInbox(req, res, queryId);
};

// GET /messages/t/:userId -> START/OPEN CHAT
exports.startChat = async (req, res) => {
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
};

// GET /messages/new -> Show the "Compose Message" form
exports.getCompose = (req, res) => {
    res.render('messages/new', { title: 'New Message' });
};

// POST /messages/new -> Find User & Start Chat
exports.postCompose = async (req, res) => {
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

        // BACKEND SENDING GATEKEEPER
        const currentUser = await User.findById(myId).select('following');
        const isFollowing = currentUser.following.includes(targetUser._id);

        if (!isFollowing) {
            return res.render('messages/new', {
                error: 'Sadece takip ettiğin kişilere mesaj gönderebilirsiniz.',
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
};

// GET /messages/:identifier -> VIEW CHAT (Supports ID or Nickname)
exports.getChat = async (req, res) => {
    try {
        const identifier = req.params.identifier;

        // Case 1: It's a Conversation ID (Legacy or Direct Link)
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            // Check if it's a CONVERSATION
            const conv = await Conversation.exists({ _id: identifier });
            if (conv) {
                return await renderInbox(req, res, identifier);
            }
        }

        // Case 2: It's a Slug (User lookup)
        // Try finding by slug (Preferred) or Nickname (Legacy fallback)
        const targetUser = await User.findOne({
            $or: [{ slug: identifier }, { nickname: identifier }]
        });
        if (targetUser) {
            // Find conversation between current user and target user
            const conversation = await Conversation.findOne({
                members: { $all: [req.session.user._id, targetUser._id] }
            });

            if (conversation) {
                // RENDER AT THIS URL (No Redirect, keeps /messages/nickname)
                return await renderInbox(req, res, conversation._id);
            } else {
                // USER REQUEST CHANGE: Do NOT create automatically. Show Error.
                return res.render('error', {
                    message: 'Böyle bir sohbet bulunamadı.',
                    description: 'Bu kullanıcıyla henüz bir sohbetiniz yok. Yeni mesaj oluşturarak başlayabilirsiniz.'
                });
            }
        }

        // Case 3: Not found -> Default Inbox
        res.redirect('/messages');

    } catch (err) {
        console.error("Message Route Error:", err);
        res.redirect('/messages');
    }
};

// POST /messages/share -> Share a post to a user
exports.sharePost = async (req, res) => {
    try {
        const { recipientId, postId, text } = req.body;
        const senderId = req.session.user._id;

        // BACKEND SENDING GATEKEEPER (Share)
        const sender = await User.findById(senderId).select('following');
        const isFollowing = sender.following.includes(recipientId);

        if (!isFollowing) {
            return res.status(403).render('error', {
                title: 'Access Denied',
                statusCode: 403,
                statusMessage: 'Forbidden',
                description: 'Sadece takip ettiğin kişilere mesaj gönderebilirsiniz.'
            });
        }

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
};

// POST /messages/:id -> SEND MESSAGE
exports.sendMessage = async (req, res) => {
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
};

// POST /messages/delete-message/:id
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.redirect('back');

        // REFACTORED PERMISSION CHECK: Sender OR Admin OR Owner
        const isSender = message.sender.toString() === req.session.user._id.toString();
        const isAdmin = ['admin', 'owner'].includes(req.session.user.role);

        if (!isSender && !isAdmin) {
            return res.redirect('back');
        }

        // const conversationId = message.conversationId;
        await Message.findByIdAndDelete(req.params.id);

        // Redirect back (Stay in place)
        res.redirect('back');
    } catch (err) {
        console.error("Delete Error:", err);
        res.redirect('back');
    }
};

// POST /messages/edit-message/:id
exports.editMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.redirect('back');

        // REFACTORED PERMISSION CHECK: Sender OR Admin OR Owner
        const isSender = message.sender.toString() === req.session.user._id.toString();
        const isAdmin = ['admin', 'owner'].includes(req.session.user.role);

        if (!isSender && !isAdmin) {
            return res.redirect('back');
        }

        const { text } = req.body;
        // Empty String Protection
        if (!text || !text.trim()) {
            return res.redirect('back');
        }

        message.text = text.trim();
        await message.save();

        // Redirect back (Stay in place)
        res.redirect('back');
    } catch (err) {
        console.error("Edit Error:", err);
        res.redirect('back');
    }
};
