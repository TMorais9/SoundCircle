const express = require('express');
const router = express.Router();
const controller = require('../controllers/usercarController');

router.get('/', controller.getAll);

router.get('/user/:user_id', controller.getByUser);

router.get('/:user_id/:caracteristica_id', controller.getByIds);

router.post('/', controller.create);

router.put('/:user_id/:caracteristica_id', controller.update);

router.delete('/:user_id/:caracteristica_id', controller.delete);

module.exports = router;
