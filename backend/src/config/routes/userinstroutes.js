const express = require('express');
const router = express.Router();
const userInstController = require('../controllers/userinstcontroller');
router.get('/', userInstController.getAll);
router.get('/:user_id/:instrumento_id', userInstController.getByIds);
router.post('/', userInstController.create);
router.put('/:user_id/:instrumento_id', userInstController.update);
router.delete('/:user_id/:instrumento_id', userInstController.delete);

module.exports = router;
