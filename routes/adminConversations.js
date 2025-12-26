const express = require('express');
const router = express.Router();

// Middleware to handle conversations logic if needed, or pass through
router.use((req, res, next) => next());

module.exports = router;
