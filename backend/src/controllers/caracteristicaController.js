const Caracteristica = require('../models/caracteristicaModel');

exports.getAll = (req, res) => {
  Caracteristica.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  Caracteristica.getById(id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Característica não encontrada' });
    res.json(rows[0]);
  });
};

exports.create = (req, res) => {
  const { nome, descricao } = req.body;

  if (!nome)
    return res.status(400).json({ message: 'O campo "nome" é obrigatório' });

  Caracteristica.create({ nome, descricao }, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Já existe uma característica com esse nome' });
      }
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({ id: result.insertId, nome, descricao });
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { nome, descricao } = req.body;

  if (!nome)
    return res.status(400).json({ message: 'O campo "nome" é obrigatório' });

  Caracteristica.update(id, { nome, descricao }, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Já existe uma característica com esse nome' });
      }
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Característica não encontrada' });

    res.json({ message: 'Característica atualizada com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;

  Caracteristica.delete(id, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ message: 'Característica eliminada com sucesso' });
  });
};
