const mongoose = require('mongoose');
require('dotenv').config();
const Post = require('../models/Post');

async function fix() {
    try {
        console.log("Connecting to DB...");
        // Use connection string from .env, fallback to local if missing (though app.js uses .env)
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/phoenix_db';
        await mongoose.connect(uri);
        console.log("Connected.");

        console.log("Resetting comments...");
        const res = await Post.updateMany({}, { $set: { comments: [] } });
        console.log(`Reset comments for ${res.modifiedCount} posts.`);

        console.log("Done.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fix();
