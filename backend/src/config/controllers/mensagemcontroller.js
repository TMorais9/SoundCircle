const Mensagem = require('../models/mensagemModel');

exports.getAll = (req, res) => {
  Mensagem.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getByUser = (req, res) => {
  const { user_id } = req.params;
  Mensagem.getByUser(user_id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getBetweenUsers = (req, res) => {
  const { remetente_id, destinatario_id } = req.params;
  Mensagem.getBetweenUsers(remetente_id, destinatario_id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.send = (req, res) => {
  const { remetente_id, destinatario_id, conteudo } = req.body;
  if (!remetente_id || !destinatario_id || !conteudo) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta' });
  }

  Mensagem.send({ remetente_id, destinatario_id, conteudo }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Mensagem enviada com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;
  Mensagem.delete(id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Mensagem eliminada com sucesso' });
  });
};