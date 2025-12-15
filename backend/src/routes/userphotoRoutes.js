const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const userPhotoController = require('../controllers/userPhotoController');

router.post('/:id/avatar', upload.single('avatar'), userPhotoController.uploadAvatar);

module.exports = router;
