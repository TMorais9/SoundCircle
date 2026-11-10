// Rotas da parte de AI. As duas chamam o algoritmo CSP que está em backend/ai/ai.py.
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Pesquisa com filtros explícitos e sem texto: um músico, ou uma banda com os instrumentos indicados.
router.post('/match', aiController.match);
// Chat do Circle AI: interpreta a frase e responde com músicos, bandas para integrar ou bandas para formar.
router.post('/chat', aiController.chat);

module.exports = router;
