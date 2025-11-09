const db = require('../config/db');

const Instrumento = {
  getAll: (callback) => {
    db.query('SELECT id, nome FROM Instrumento ORDER BY nome ASC', callback);
  },

  getById: (id, callback) => {
    db.query('SELECT id, nome FROM Instrumento WHERE id = ?', [id], callback);
  },

  create: ({ nome }, callback) => {
    db.query('INSERT INTO Instrumento (nome) VALUES (?)', [nome], callback);
  },

  update: (id, nome, callback) => {
    db.query('UPDATE Instrumento SET nome = ? WHERE id = ?', [nome, id], callback);
  },

  delete: (id, callback) => {
    db.query('DELETE FROM Instrumento WHERE id = ?', [id], callback);
  },
};

module.exports = Instrumento;
