const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || '') || '.png';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

const handleUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'A foto é demasiado grande (máximo 8MB)' });
    }
    return res.status(400).json({ message: err.message || 'Falha ao processar a foto' });
  });
};

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.get('/:id/profile', userController.getProfile);

router.post('/', userController.create);
router.put('/:id', userController.update);
router.put('/:id/password', userController.updatePassword);
router.post('/:id/photo', handleUpload, userController.uploadPhoto);
router.delete('/:id', userController.delete);

router.post('/login', userController.login);

module.exports = router;
