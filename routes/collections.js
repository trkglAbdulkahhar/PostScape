const express = require('express');
const router = express.Router();
const collectionsController = require('../controllers/collectionsController');

// Middleware
router.use((req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
});

// POST /collections/save -> Toggle Save (Add or Remove)
router.post('/save', collectionsController.saveCollection);

// GET /collections/:id -> View Single Collection (The Posts inside)
router.get('/:id', collectionsController.getCollection);

module.exports = router;
