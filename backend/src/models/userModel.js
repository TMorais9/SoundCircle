const db = require('../config/db');

const User = {
  getAll: (callback) => {
    db.query(
      'SELECT id, nome, email, tipo, descricao, foto_url, data_nascimento FROM User',
      callback
    );
  },

  getById: (id, callback) => {
    db.query(
      'SELECT id, nome, email, tipo, descricao, foto_url, data_nascimento FROM User WHERE id = ?',
      [id],
      callback
    );
  },

  create: (data, callback) => {
    db.query(
      `INSERT INTO User (nome, email, password_hash, tipo, descricao, foto_url, data_nascimento)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nome,
        data.email,
        data.password_hash,
        data.tipo,
        data.descricao || null,
        data.foto_url || null,
        data.data_nascimento || null,
      ],
      callback
    );
  },

  update: (id, data, callback) => {
    db.query(
      `UPDATE User
       SET nome = ?, email = ?, tipo = ?, descricao = ?, foto_url = ?, data_nascimento = ?
       WHERE id = ?`,
      [
        data.nome,
        data.email,
        data.tipo,
        data.descricao || null,
        data.foto_url || null,
        data.data_nascimento || null,
        id,
      ],
      callback
    );
  },

  updatePassword: (id, password_hash, callback) => {
    db.query(
      'UPDATE User SET password_hash = ? WHERE id = ?',
      [password_hash, id],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM User WHERE id = ?', [id], callback);
  },

  getByEmail: (email, callback) => {
    db.query('SELECT * FROM User WHERE email = ?', [email], callback);
  },

  getInstrumentsByUser: (userId, callback) => {
    db.query(
      `SELECT ui.instrumento_id,
              i.nome AS instrumento_nome,
              ui.nivel
       FROM User_inst ui
       JOIN Instrumento i ON i.id = ui.instrumento_id
       WHERE ui.user_id = ?
       ORDER BY i.nome ASC`,
      [userId],
      callback
    );
  },
};

module.exports = User;
