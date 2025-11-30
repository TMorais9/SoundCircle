const express = require('express');
const { getAll, getByIds, create, update, deleteUserInst } = require('../controllers/userinstController');
const { getByUserWithNames } = require('../models/userinstmodel');
const router = express.Router();

router.get('/', getAll);
router.get('/:user_id/:instrumento_id', getByIds);
router.get('/user/:user_id/named', getByUserWithNames);

router.post('/', create);
router.put('/:user_id/:instrumento_id', update);
router.delete('/:user_id/:instrumento_id', deleteUserInst);

module.exports = router;
