require('dotenv').config();

// 1. Imports
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Middleware Imports
const { csrfMiddleware, csrfTokenInjector, csrfErrorHandler } = require('./middleware/csrf');
const isAuthenticated = require('./middleware/isAuth');
const globalLocals = require('./middleware/globalLocals');
const { notFound, globalError } = require('./middleware/errorHandlers');

// 2. Database Connection
const connectDB = require('./config/db');
connectDB();

// 3. Model Registration (Critical)
require('./models/User');
require('./models/Post');
require('./models/Comment');

// Add this temporary startup script to app.js
const cleanGhosts = async () => {
    try {
        const User = require('./models/User');
        const Post = require('./models/Post');

        // 1. SLUG MIGRATION
        const postsWithoutSlug = await Post.find({ slug: { $exists: false } });
        if (postsWithoutSlug.length > 0) {
            console.log(`🐌 Migrating ${postsWithoutSlug.length} posts to slugs...`);
            for (let post of postsWithoutSlug) {
                // Pre-save hook will generate the slug
                await post.save();
            }
            console.log("✅ Slug migration complete.");
        }

        // 2. USER GHOST CLEANUP & SLUG MIGRATION
        const users = await User.find();
        const slugify = require('slugify');

        for (let user of users) {
            // SLUG GENERATION
            if (!user.slug && user.nickname) {
                user.slug = slugify(user.nickname, { lower: true, strict: true, locale: 'tr' });
                await user.save({ validateBeforeSave: false });
            }

            // ... existing cleanup logic ...
            if (user.interests && user.interests.length > 0 && typeof user.interests[0] === 'string' && user.interests[0].includes('{')) {
                user.interests = [];
            }

            // Sadece gerçekten DB'de var olan postları tut
            const validLiked = [];
            for (let id of user.likedPosts) {
                const exists = await Post.exists({ _id: id });
                if (exists) validLiked.push(id);
            }

            const validSaved = [];
            for (let id of user.savedPosts) {
                const exists = await Post.exists({ _id: id });
                if (exists) validSaved.push(id);
            }

            user.likedPosts = validLiked;
            user.savedPosts = validSaved;

            await user.save({ validateBeforeSave: false });
        }
    } catch (err) {
        console.error("Startup Script Error:", err);
    }
};
cleanGhosts(); // Run on start

// Temporary Admin Promotion Script
const promoteAdmin = async () => {
    try {
        const User = require('./models/User');
        await User.findOneAndUpdate({ email: 'tester@example.com' }, { role: 'admin' });
    } catch (err) {
        console.log('Hata:', err);
    }
};
// promoteAdmin(); // Disabled to preserve 'Owner' role from fix_roles.js

// Initialize App
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// 4. Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions",
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// CSRF Protection & Token Injection
app.use(csrfMiddleware);
app.use(csrfTokenInjector);
app.use(csrfErrorHandler);

// 5. View Engine
app.engine('.hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        // NEW HELPER: Check if array includes value (Handles ObjectIds safely)
        includes: function (array, value) {
            if (!Array.isArray(array) || !value) return false;
            return array.map(i => i.toString()).includes(value.toString());
        },
        // NEW HELPER: Check if message is editable (under 30 seconds)
        isEditable: (createdAt) => {
            const now = new Date();
            const created = new Date(createdAt);
            const diff = now - created;
            return diff < 30000; // 30000 ms = 30 seconds
        },
        formatDate: function (date) {
            if (!date) return '';
            return new Date(date).toLocaleString([], {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        // NEW HELPER: Check if message is editable (under 30 seconds)
        canEdit: function (createdAt) {
            const now = new Date();
            const created = new Date(createdAt);
            const diff = now - created;
            return diff < 30000;
        },
        eq: function (a, b) { return String(a) === String(b); },
        notEq: function (a, b) { return String(a) !== String(b); },
        or: function (a, b) { return a || b; },
        formatTime: (date) => {
            const d = new Date(date);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        },
        truncate: function (str, len) {
            if (str && str.length > len) {
                return str.substring(0, len - 3) + '...';
            }
            return str;
        },
        initials: function (name) {
            if (!name) return '??';
            return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        },
        toString: function (val) { return String(val); },
        // NEW HELPER: Check if user liked the post
        isLikedByUser: function (likesArray, userId) {
            if (!likesArray || !userId) return false;
            // likesArray içindeki her bir ID'yi stringe çevirip kullanıcının ID'si ile kıyaslar
            return likesArray.some(id => id.toString() === userId.toString());
        },
        isFollowing: function (userId, followersArray) {
            if (!userId || !followersArray) return false;
            return followersArray.some(id => id.toString() === userId.toString());
        },
        slugify: function (text) {
            if (!text) return '';
            const slugify = require('slugify'); // Require inside helper to ensure it's available
            return slugify(text, { lower: true, strict: true, locale: 'tr' });
        },
        stripTags: function (input) {
            if (!input) return '';
            return input.replace(/<(?:.|\n)*?>/gm, '');
        }
    }
}));
app.set('view engine', '.hbs');
app.set('views', './views');

// 6. Global Variables & Auth Logic

// Auth Guard Middleware
// 6. Global Variables & Auth Logic

// --- GLOBAL DATA MIDDLEWARE ---
app.use(globalLocals);

// Socket.io Logic
let onlineUsers = new Set();

io.on('connection', (socket) => {
    // 1. Add new connection
    onlineUsers.add(socket.id);

    // 2. Broadcast new count
    io.emit('updateOnlineCount', onlineUsers.size);

    socket.on('join', (userId) => {
        if (userId) socket.join(userId);
    });

    // 3. Handle disconnect
    socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        io.emit('updateOnlineCount', onlineUsers.size);
    });
});

// 7. Routes

// Public Routes
app.use('/auth', require('./routes/auth'));

// Master Setup (Temporary)
app.get('/secret-setup-owner', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).send('Login first');
    try {
        await mongoose.model('User').findByIdAndUpdate(req.session.user._id, { role: 'owner' });
        req.session.user.role = 'owner';
        res.send('You are now Owner! <a href="/master">Go to Master Panel</a>');
    } catch (err) { res.status(500).send(err.message); }
});



// Protected Routes Guard
app.use(isAuthenticated); // Önce giriş yapılmış mı bak

const { isAdmin, isOwner } = require('./middleware/auth');
const adminRoutes = require('./routes/admin');
const masterRoutes = require('./routes/master');

// 1. ÖZEL PANELLER (Yüksek Öncelik - Tıkanmayı Önlemek İçin En Üste)
app.use('/admin', isAdmin, adminRoutes);
app.use('/master', isOwner, masterRoutes);

// 2. KULLANICI ÖZELLİKLERİ
app.use('/user', require('./routes/user'));
app.use('/posts', require('./routes/posts'));
app.use('/messages', require('./routes/messages'));
app.use('/collections', require('./routes/collections'));
app.use('/notifications', require('./routes/notification')); // NEW ROUTE

// 3. GENEL SAYFALAR (En Düşük Öncelik)
app.use('/', require('./routes/index'));
app.use('/', require('./routes/adminConversations'));

// 8. Error Handling
app.use(notFound);
app.use(globalError);
// 9. Server Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
});