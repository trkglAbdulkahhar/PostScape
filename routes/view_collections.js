const express = require('express');
const router = express.Router();

// View Placeholder
router.get('/', (req, res) => res.send('<h1>Collections View Active</h1>'));

module.exports = router;
