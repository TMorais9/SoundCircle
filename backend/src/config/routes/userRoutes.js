const express = require('express');
const router = express.Router();
const userController = require('../controllers/usercontroller');
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

router.put('/:id/password', userController.updatePassword);

router.get('/:id/profile', userController.getProfile);

router.post('/login', userController.login);

module.exports = router;
