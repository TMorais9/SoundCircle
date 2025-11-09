const express = require('express');
const router = express.Router();
const mensagemController = require('../controllers/mensagemController');

router.get('/', mensagemController.getAll);
router.get('/user/:user_id', mensagemController.getByUser);
router.get('/:remetente_id/:destinatario_id', mensagemController.getBetweenUsers);

router.post('/', mensagemController.create);
router.put('/:id', mensagemController.update);
router.delete('/:id', mensagemController.delete);

module.exports = router;
