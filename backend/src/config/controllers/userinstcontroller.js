const UserInst = require('../models/userInstModel');

exports.getAll = (req, res) => {
  UserInst.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getByIds = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  UserInst.getByIds(user_id, instrumento_id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Registo não encontrado' });
    res.json(results[0]);
  });
};

exports.create = (req, res) => {
  const { user_id, instrumento_id, nivel } = req.body;
  UserInst.create({ user_id, instrumento_id, nivel }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Registo criado com sucesso' });
  });
};

exports.update = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  const { nivel } = req.body;
  UserInst.update(user_id, instrumento_id, nivel, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Nível atualizado com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  UserInst.delete(user_id, instrumento_id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Registo eliminado com sucesso' });
  });
};
