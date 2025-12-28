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
    },
    slug: { type: String, unique: true }
});

const slugify = require('slugify');

PostSchema.pre('validate', async function (next) {
    if (this.title) {
        const baseSlug = slugify(this.title, { lower: true, strict: true, locale: 'tr' });
        let slugCandidate = baseSlug;
        let counter = 1;

        // Loop until unique slug is found
        while (await this.constructor.exists({ slug: slugCandidate, _id: { $ne: this._id } })) {
            slugCandidate = `${baseSlug}-${counter}`;
            counter++;
        }
        this.slug = slugCandidate;
    }
    next();
});

module.exports = mongoose.model('Post', PostSchema);
