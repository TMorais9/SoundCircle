const db = require('../config/db');

const Caracteristica = {
  getAll: (callback) => {
    db.query(
      'SELECT id, nome, descricao FROM Caracteristica ORDER BY nome ASC',
      callback
    );
  },

  getById: (id, callback) => {
    db.query(
      'SELECT id, nome, descricao FROM Caracteristica WHERE id = ?',
      [id],
      callback
    );
  },

  create: (data, callback) => {
    db.query(
      'INSERT INTO Caracteristica (nome, descricao) VALUES (?, ?)',
      [data.nome, data.descricao || null],
      callback
    );
  },

  update: (id, data, callback) => {
    db.query(
      'UPDATE Caracteristica SET nome = ?, descricao = ? WHERE id = ?',
      [data.nome, data.descricao || null, id],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM Caracteristica WHERE id = ?', [id], callback);
  },
};

module.exports = Caracteristica;
