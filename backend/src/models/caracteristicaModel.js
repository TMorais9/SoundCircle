const db = require('../config/db');

const Caracteristica = {
  getAll: (callback) => {
    db.query(
      'SELECT id, nome FROM Caracteristica ORDER BY nome ASC',
      callback
    );
  },

  getById: (id, callback) => {
    db.query(
      'SELECT id, nome FROM Caracteristica WHERE id = ?',
      [id],
      callback
    );
  },

  create: (data, callback) => {
    db.query(
      'INSERT INTO Caracteristica (nome) VALUES (?)',
      [data.nome],
      callback
    );
  },

  update: (id, data, callback) => {
    db.query(
      'UPDATE Caracteristica SET nome = ? WHERE id = ?',
      [data.nome, id],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM Caracteristica WHERE id = ?', [id], callback);
  },
};

module.exports = Caracteristica;
