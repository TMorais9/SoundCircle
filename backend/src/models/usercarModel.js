const db = require('../config/db');

const UserCar = {
  getAll: (callback) => {
    db.query('SELECT * FROM UserCar', callback);
  },

  getByUser: (user_id, callback) => {
    db.query(
      'SELECT * FROM UserCar WHERE user_id = ?',
      [user_id],
      callback
    );
  },

  getByIds: (user_id, caracteristica_id, callback) => {
    db.query(
      'SELECT * FROM UserCar WHERE user_id = ? AND caracteristica_id = ?',
      [user_id, caracteristica_id],
      callback
    );
  },

  create: (data, callback) => {
    db.query(
      'INSERT INTO UserCar (user_id, caracteristica_id, valor) VALUES (?, ?, ?)',
      [data.user_id, data.caracteristica_id, data.valor || null],
      callback
    );
  },

  update: (user_id, caracteristica_id, valor, callback) => {
    db.query(
      'UPDATE UserCar SET valor = ? WHERE user_id = ? AND caracteristica_id = ?',
      [valor || null, user_id, caracteristica_id],
      callback
    );
  },

  delete: (user_id, caracteristica_id, callback) => {
    db.query(
      'DELETE FROM UserCar WHERE user_id = ? AND caracteristica_id = ?',
      [user_id, caracteristica_id],
      callback
    );
  },

  deleteByUser: (user_id, callback) => {
    db.query('DELETE FROM UserCar WHERE user_id = ?', [user_id], callback);
  },

  bulkInsert: (user_id, caracteristicaIds, callback) => {
    if (!Array.isArray(caracteristicaIds) || !caracteristicaIds.length) {
      return callback(null, { affectedRows: 0 });
    }
    const values = caracteristicaIds.map((id) => [user_id, id]);
    db.query(
      'INSERT IGNORE INTO UserCar (user_id, caracteristica_id) VALUES ?',
      [values],
      callback
    );
  },
};

module.exports = UserCar;
