import UserInst from '../models/userInstModel.js';

const getAll = (req, res) => {
  UserInst.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

const getByIds = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  UserInst.getByIds(user_id, instrumento_id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Registo não encontrado' });
    res.json(results[0]);
  });
};

const create = (req, res) => {
  const { user_id, instrumento_id, nivel } = req.body;
  UserInst.create({ user_id, instrumento_id, nivel }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Registo criado com sucesso' });
  });
};

const update = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  const { nivel } = req.body;
  UserInst.update(user_id, instrumento_id, nivel, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Nível atualizado com sucesso' });
  });
};

const deleteUserInst = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  UserInst.delete(user_id, instrumento_id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Registo eliminado com sucesso' });
  });
};

export {
  getAll,
  getByIds,
  create,
  update,
  deleteUserInst,
};