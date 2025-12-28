const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getLogin = (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login');
};

exports.getRegister = (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('register');
};

exports.postRegister = async (req, res) => {
    try {
        const { name, email, password, adminCode } = req.body;
        // Simple validation
        if (!name || !email || !password) {
            return res.status(400).send('Please enter all fields');
        }

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).send('User already exists');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // ROLE VALIDATION
        let finalRole = 'user';

        // If user is trying to register as admin (via tab selection)
        if (req.body.role === 'admin') {
            // Use Environment Variable for Security
            if (adminCode === process.env.ADMIN_SECRET_CODE) {
                finalRole = 'admin';
                console.log("⚠️ GİZLİ KOD DOĞRULANDI: Yeni bir Admin kaydediliyor!");
            } else {
                // STRICT CHECK: Code is wrong -> Reject with specific feedback
                return res.render('register', {
                    layout: 'main',
                    error: '❌ Invalid Admin Code! Access Denied.',
                    adminError: true, // Trigger frontend visual error
                    isAdmin: true, // Keep Admin tab active
                    email: req.body.email, // Preserve form data
                    name: req.body.name
                });
            }
        }

        // Create user
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: finalRole
        });

        await user.save();

        // AUTO-LOGIN: Kayıt sonrası oturumu aç
        req.session.user = user;
        req.session.save(() => {
            // Yönlendirme
            res.redirect('/setup-profile');
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('Invalid Credentials');
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid Credentials');
        }

        // Init session
        req.session.user = user;
        req.session.save(() => {
            // Safety: Check if profile is complete
            if (!user.isProfileComplete) {
                return res.redirect('/setup-profile');
            }
            res.redirect('/feed'); // Redirect to Feed
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/auth/login');
    });
};
