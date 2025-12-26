const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    coverImage: {
        type: String, // URL of the last added post's image
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Collection', CollectionSchema);
