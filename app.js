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
        const users = await User.find();

        for (let user of users) {
            // Fix interest format if it's that weird string
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

            // Save without validation to be silent
            await user.save({ validateBeforeSave: false });
        }
        console.log("✨ System Sync: OK");
    } catch (err) {
        // Silent
    }
};
cleanGhosts(); // Run on start

// Temporary Admin Promotion Script
const promoteAdmin = async () => {
    try {
        const User = require('./models/User');
        await User.findOneAndUpdate({ email: 'tester@example.com' }, { role: 'admin' });
        console.log('👑 Admin yetkisi başarıyla verildi: tester@example.com');
    } catch (err) {
        console.log('Hata:', err);
    }
};
promoteAdmin();

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
        }
    }
}));
app.set('view engine', '.hbs');
app.set('views', './views');

// 6. Global Variables & Auth Logic

// Auth Guard Middleware
function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/auth/login');
    }
    res.locals.currentUser = req.session.user;
    next();
}

// --- GLOBAL DATA MIDDLEWARE (The Fix) ---
app.use(async (req, res, next) => {
    // Default locals
    res.locals.user = null; // Important: use 'user' not 'currentUser' to match views if possible, or adapt views
    res.locals.currentUser = null; // Keep compatibility
    res.locals.collections = [];
    res.locals.onlineCount = 1;
    res.locals.savedPostIds = []; // Critical for the Icons

    if (req.session && req.session.user) {
        try {
            // 1. FRESH USER FETCH: Always get the latest data from DB
            const User = mongoose.model('User');
            const user = await User.findById(req.session.user._id).lean();

            if (user) {
                // Update session if needed (optional) but rely on local variable
                res.locals.user = user;
                res.locals.currentUser = user; // Backup

                // Update Last Active
                await User.findByIdAndUpdate(user._id, { lastActive: new Date() });

                // 2. FETCH COLLECTIONS for Dropdowns/Modals
                const Collection = mongoose.model('Collection');
                const myCollections = await Collection.find({ user: user._id }).sort({ updatedAt: -1 }).lean();
                res.locals.collections = myCollections || [];

                // 3. CALCULATE SAVED POST IDS (For Icons)
                // Flatten the arrays so we know what is saved globally
                if (myCollections && myCollections.length > 0) {
                    res.locals.savedPostIds = myCollections.flatMap(c => c.posts.map(p => p.toString()));
                }

                // 4. FETCH RECENT CONTACTS (For Share Modal)
                // Find conversations where user is a member
                const Conversation = mongoose.model('Conversation');
                let recentConvos = await Conversation.find({ members: user._id })
                    .populate('members', 'name')
                    .sort({ updatedAt: -1 })
                    .lean();

                // Extract the "Other User" from each conversation
                const recentContacts = recentConvos.map(c => {
                    const other = c.members.find(m => m._id.toString() !== user._id.toString());
                    return {
                        _id: other ? other._id : null,
                        name: other ? other.name : 'Unknown User',
                        conversationId: c._id // Optional, but useful
                    };
                }).filter(c => c._id); // Filter out nulls

                res.locals.recentContacts = recentContacts;

            } else {
                // User in session but not in DB? Force logout.
                req.session.destroy();
            }
        } catch (err) {
            console.error("Global Middleware Error:", err);
        }
    }

    // 4. ONLINE COUNT (Global)
    try {
        const User = mongoose.model('User');
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const count = await User.countDocuments({ lastActive: { $gte: fiveMinAgo } });
        res.locals.onlineCount = count;
    } catch (e) { console.error(e); }

    next();
});

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
app.use(isAuthenticated);



// Specific Routes First
app.use('/admin', require('./routes/admin'));
app.use('/master', require('./routes/master'));
app.use('/', require('./routes/adminConversations')); // Check this path

// Feature Routes
app.use('/', require('./routes/user'));
app.use('/posts', require('./routes/posts'));
app.use('/messages', require('./routes/messages'));
app.use('/collections', require('./routes/collections')); // Register Collections Route

// 4. Root Route & Dashboard
app.use('/', require('./routes/index'));

// 8. Error Handling
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: 'Not Found',
        statusCode: 404,
        statusMessage: 'Not Found',
        description: 'The page you are looking for does not exist.'
    });
});

app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    const statusCode = err.status || 500;
    res.status(statusCode).render('error', {
        title: 'Error',
        statusCode,
        statusMessage: statusCode === 404 ? 'Not Found' : 'Server Error',
        description: 'An unexpected error occurred.'
    });
});

// 9. Server Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
