const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new mongoose.Schema({
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Who gets the notification
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },    // Who triggered it
    type: { type: String, enum: ['follow', 'like', 'comment'], required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },      // Optional: relevant post
    read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
