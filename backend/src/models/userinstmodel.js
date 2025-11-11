const db = require('../config/db');

const ensureExperienceColumn = () => {
  db.query("SHOW COLUMNS FROM User_inst LIKE 'anos_experiencia'", (err, rows) => {
    if (err) {
      console.error('Não foi possível verificar coluna anos_experiencia:', err.message);
      return;
    }
    if (rows.length === 0) {
      db.query(
        'ALTER TABLE User_inst ADD COLUMN anos_experiencia INT UNSIGNED NULL AFTER nivel',
        (alterErr) => {
          if (alterErr) {
            console.error('Falha ao adicionar coluna anos_experiencia:', alterErr.message);
          } else {
            console.log('Coluna anos_experiencia adicionada à tabela User_inst.');
          }
        }
      );
    }
  });
};

ensureExperienceColumn();

const UserInst = {
  getAll: (callback) => {
    db.query('SELECT user_id, instrumento_id, nivel, anos_experiencia FROM User_inst', callback);
  },

  getByIds: (user_id, instrumento_id, callback) => {
    db.query(
      'SELECT user_id, instrumento_id, nivel, anos_experiencia FROM User_inst WHERE user_id = ? AND instrumento_id = ?',
      [user_id, instrumento_id],
      callback
    );
  },

  getByUserWithNames: (user_id, callback) => {
    db.query(
      `SELECT ui.user_id,
              ui.instrumento_id,
              i.nome AS instrumento_nome,
              ui.nivel,
              ui.anos_experiencia
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
      'INSERT INTO User_inst (user_id, instrumento_id, nivel, anos_experiencia) VALUES (?, ?, ?, ?)',
      [data.user_id, data.instrumento_id, data.nivel, data.anos_experiencia ?? null],
      callback
    );
  },

  upsert: (data, callback) => {
    db.query(
      `INSERT INTO User_inst (user_id, instrumento_id, nivel, anos_experiencia)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nivel = VALUES(nivel),
                               anos_experiencia = VALUES(anos_experiencia)`,
      [data.user_id, data.instrumento_id, data.nivel, data.anos_experiencia ?? null],
      callback
    );
  },

  update: (user_id, instrumento_id, nivel, anos_experiencia, callback) => {
    db.query(
      'UPDATE User_inst SET nivel = ?, anos_experiencia = ? WHERE user_id = ? AND instrumento_id = ?',
      [nivel, anos_experiencia ?? null, user_id, instrumento_id],
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
