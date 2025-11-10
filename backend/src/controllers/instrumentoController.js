const Instrumento = require('../models/instrumentoModel');

exports.getAll = (req, res) => {
  Instrumento.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  Instrumento.getById(id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Instrumento não encontrado' });
    res.json(rows[0]);
  });
};

exports.create = (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ message: 'Campo "nome" é obrigatório' });

  Instrumento.create({ nome }, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Já existe um instrumento com esse nome' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: result.insertId, nome });
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ message: 'Campo "nome" é obrigatório' });

  Instrumento.update(id, nome, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Já existe um instrumento com esse nome' });
      }
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Instrumento não encontrado' });
    }
    res.json({ message: 'Instrumento atualizado com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;
  Instrumento.delete(id, (err) => {
    if (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({
          message: 'Não é possível eliminar: instrumento está associado a utilizadores',
        });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Instrumento eliminado com sucesso' });
  });
};
