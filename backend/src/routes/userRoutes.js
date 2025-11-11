const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.get('/:id/profile', userController.getProfile);

router.post('/', userController.create);
router.put('/:id', userController.update);
router.put('/:id/password', userController.updatePassword);
router.delete('/:id', userController.delete);

router.post('/login', userController.login);

module.exports = router;
