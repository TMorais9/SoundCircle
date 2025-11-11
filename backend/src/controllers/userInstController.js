const UserInst = require('../models/userinstmodel');

const normalizeYears = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

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
  const anosPayload = req.body.anos_experiencia ?? req.body.anosExperiencia;
  UserInst.create(
    { user_id, instrumento_id, nivel, anos_experiencia: normalizeYears(anosPayload) },
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Registo criado com sucesso' });
    }
  );
};

const update = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  const { nivel } = req.body;
  const anosPayload = req.body.anos_experiencia ?? req.body.anosExperiencia;
  UserInst.update(
    user_id,
    instrumento_id,
    nivel,
    normalizeYears(anosPayload),
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Nível atualizado com sucesso' });
    }
  );
};

const deleteUserInst = (req, res) => {
  const { user_id, instrumento_id } = req.params;
  UserInst.delete(user_id, instrumento_id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Registo eliminado com sucesso' });
  });
};

module.exports = {
  getAll,
  getByIds,
  create,
  update,
  deleteUserInst,
};
