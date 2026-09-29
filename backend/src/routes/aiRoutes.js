const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/match', aiController.match);
router.post('/chat', aiController.chat);

module.exports = router;
