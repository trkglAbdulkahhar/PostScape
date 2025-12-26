const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    text: {
        type: String,
        // Text is optional if sharing a post (but usually present)
    },
    // NEW FIELD:
    sharedPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
