const db = require('../config/db');

const Mensagem = {
  getAll: (callback) => {
    db.query('SELECT * FROM mensagens', callback);
  },

  getByUser: (userId, callback) => {
    db.query(
      'SELECT * FROM mensagens WHERE remetente_id = ? OR destinatario_id = ? ORDER BY data_envio DESC',
      [userId, userId],
      callback
    );
  },

  getBetweenUsers: (remetenteId, destinatarioId, callback) => {
    db.query(
      'SELECT * FROM mensagens WHERE (remetente_id = ? AND destinatario_id = ?) OR (remetente_id = ? AND destinatario_id = ?) ORDER BY data_envio ASC',
      [remetenteId, destinatarioId, destinatarioId, remetenteId],
      callback
    );
  },

  send: (data, callback) => {
    db.query(
      'INSERT INTO mensagens (remetente_id, destinatario_id, conteudo) VALUES (?, ?, ?)',
      [data.remetente_id, data.destinatario_id, data.conteudo],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM mensagens WHERE id = ?', [id], callback);
  },
};

module.exports = Mensagem;