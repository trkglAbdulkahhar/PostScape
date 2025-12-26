const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    image: { type: String }, // Stores filename like '123.jpg'
    tags: [{ type: String }], // Array of strings for @hashtags
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        text: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Post', PostSchema);
