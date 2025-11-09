const db = require('../config/db');

const UserInst = {
  getAll: (callback) => {
    db.query('SELECT * FROM User_inst', callback);
  },

  getByIds: (user_id, instrumento_id, callback) => {
    db.query(
      'SELECT * FROM User_inst WHERE user_id = ? AND instrumento_id = ?',
      [user_id, instrumento_id],
      callback
    );
  },

  getByUserWithNames: (user_id, callback) => {
    db.query(
      `SELECT ui.user_id,
              ui.instrumento_id,
              i.nome AS instrumento_nome,
              ui.nivel
       FROM User_inst ui
       JOIN Instrumento i ON i.id = ui.instrumento_id
       WHERE ui.user_id = ?
       ORDER BY i.nome ASC`,
      [user_id],
      callback
    );
  },

  create: (data, callback) => {
    db.query(
      'INSERT INTO User_inst (user_id, instrumento_id, nivel) VALUES (?, ?, ?)',
      [data.user_id, data.instrumento_id, data.nivel],
      callback
    );
  },

  update: (user_id, instrumento_id, nivel, callback) => {
    db.query(
      'UPDATE User_inst SET nivel = ? WHERE user_id = ? AND instrumento_id = ?',
      [nivel, user_id, instrumento_id],
      callback
    );
  },

  delete: (user_id, instrumento_id, callback) => {
    db.query(
      'DELETE FROM User_inst WHERE user_id = ? AND instrumento_id = ?',
      [user_id, instrumento_id],
      callback
    );
  },
};

module.exports = UserInst;
