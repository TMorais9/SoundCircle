const UserCar = require('../models/usercarModel');

exports.getAll = (req, res) => {
  UserCar.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getByUser = (req, res) => {
  const { user_id } = req.params;
  UserCar.getByUser(user_id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getByIds = (req, res) => {
  const { user_id, caracteristica_id } = req.params;

  UserCar.getByIds(user_id, caracteristica_id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length)
      return res.status(404).json({ message: 'Registo não encontrado' });
    res.json(rows[0]);
  });
};

exports.create = (req, res) => {
  const { user_id, caracteristica_id, valor } = req.body;

  if (!user_id || !caracteristica_id) {
    return res.status(400).json({
      message: 'user_id e caracteristica_id são obrigatórios',
    });
  }

  UserCar.create({ user_id, caracteristica_id, valor }, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({
      message: 'Característica associada ao utilizador com sucesso',
    });
  });
};

exports.update = (req, res) => {
  const { user_id, caracteristica_id } = req.params;
  const { valor } = req.body;

  UserCar.update(user_id, caracteristica_id, valor, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Registo não encontrado' });

    res.json({ message: 'Valor atualizado com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { user_id, caracteristica_id } = req.params;

  UserCar.delete(user_id, caracteristica_id, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ message: 'Registo eliminado com sucesso' });
  });
};
