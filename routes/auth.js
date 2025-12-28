const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login Page
router.get('/login', authController.getLogin);

// Register Page
router.get('/register', authController.getRegister);

// Register Logic
router.post('/register', authController.postRegister);

// Login Logic
router.post('/login', authController.postLogin);

// Logout
router.get('/logout', authController.logout);

module.exports = router;
