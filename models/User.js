const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    interests: { type: mongoose.Schema.Types.Mixed, default: {} },
    likedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // New Pending System
    // Profile Fields
    isProfileComplete: { type: Boolean, default: false },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    nickname: { type: String, default: "" },
    slug: { type: String, unique: true, sparse: true }, // Sparse allows nulls initially
    jobTitle: { type: String, default: "" },
    age: { type: Number },
    linkedinUrl: { type: String, default: "" },
    githubUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    // Role Field
    role: {
        type: String,
        enum: ['user', 'admin', 'owner'],
        default: 'user'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
