const express = require('express');
const router = express.Router();
const mensagemController = require('../controllers/mensagemcontroller');
//const uploadMensagem = require('../middleware/uploadMensagem');

router.get('/', mensagemController.getAll);
router.get('/user/:user_id', mensagemController.getByUser);
router.get('/:remetente_id/:destinatario_id', mensagemController.getBetweenUsers);
router.post('/', mensagemController.send);

//router.post(
//  '/media',
//  uploadMensagem.single('media'),
//  mensagemController.createComMedia
//);

router.delete('/:id', mensagemController.delete);

module.exports = router;
