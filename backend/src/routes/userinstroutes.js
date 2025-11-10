const express = require('express');
const { getAll } = require('../controllers/userinstcontroller');
const router = express.Router();

router.get('/', getAll);
router.get('/:user_id/:instrumento_id', ctrl.getByIds);
router.get('/user/:user_id/named', ctrl.getByUserWithNames);

router.post('/', ctrl.create);
router.put('/:user_id/:instrumento_id', ctrl.update);
router.delete('/:user_id/:instrumento_id', ctrl.delete);

module.exports = router;
