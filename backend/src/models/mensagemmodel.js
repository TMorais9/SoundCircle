const db = require('../config/db');

const Mensagem = {
  getAll: (callback) => {
    db.query(
      'SELECT id, remetente_id, destinatario_id, conteudo, media_path, media_tipo, data_envio FROM mensagens',
      callback
    );
  },

  getByUser: (userId, callback) => {
    db.query(
      `SELECT id, remetente_id, destinatario_id, conteudo, media_path, media_tipo, data_envio
       FROM mensagens
       WHERE remetente_id = ? OR destinatario_id = ?
       ORDER BY data_envio DESC`,
      [userId, userId],
      callback
    );
  },

  getBetweenUsers: (a, b, callback) => {
    db.query(
      `SELECT id, remetente_id, destinatario_id, conteudo, media_path, media_tipo, data_envio
       FROM mensagens
       WHERE (remetente_id = ? AND destinatario_id = ?)
          OR (remetente_id = ? AND destinatario_id = ?)
       ORDER BY data_envio ASC`,
      [a, b, b, a],
      callback
    );
  },

  send: (data, callback) => {
    const {
      remetente_id,
      destinatario_id,
      conteudo = null,
      media_path = null,
      media_tipo = null,
    } = data;

    db.query(
      `INSERT INTO mensagens
         (remetente_id, destinatario_id, conteudo, media_path, media_tipo)
       VALUES (?, ?, ?, ?, ?)`,
      [remetente_id, destinatario_id, conteudo, media_path, media_tipo],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM mensagens WHERE id = ?', [id], callback);
  },
};

module.exports = Mensagem;
