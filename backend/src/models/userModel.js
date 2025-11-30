const db = require('../config/db');

const User = {
  getAll: (callback) => {
    db.query(
      `SELECT
         u.id,
         u.nome,
         u.email,
         u.tipo,
         u.sexo,
         u.descricao,
         u.foto_url,
         u.data_nascimento,
         u.localizacao,
         MIN(ui.anos_experiencia) AS anos_experiencia,
         MIN(i.nome) AS instrumento_nome
       FROM User u
       LEFT JOIN User_inst ui ON ui.user_id = u.id
       LEFT JOIN Instrumento i ON i.id = ui.instrumento_id
       GROUP BY u.id, u.nome, u.email, u.tipo, u.sexo, u.descricao, u.foto_url, u.data_nascimento, u.localizacao`,
      callback
    );
  },

  getById: (id, callback) => {
    db.query(
      'SELECT id, nome, email, tipo, sexo, descricao, foto_url, data_nascimento, localizacao FROM User WHERE id = ?',
      [id],
      callback
    );
  },

  getByEmail: (email, callback) => {
    db.query('SELECT * FROM User WHERE email = ?', [email], callback);
  },

  create: (data, callback) => {
    db.query(
      `INSERT INTO User (nome, email, password_hash, tipo, sexo, descricao, foto_url, data_nascimento, localizacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nome,
        data.email,
        data.password_hash,
        data.tipo,
        data.sexo || null,
        data.descricao || null,
        data.foto_url || null,
        data.data_nascimento || null,
        data.localizacao || '',
      ],
      callback
    );
  },

  update: (id, data, callback) => {
    db.query(
      `UPDATE User
       SET nome = ?, email = ?, tipo = ?, sexo = ?, descricao = ?, foto_url = ?, data_nascimento = ?, localizacao = ?
       WHERE id = ?`,
      [
        data.nome,
        data.email,
        data.tipo,
        data.sexo || null,
        data.descricao || null,
        data.foto_url || null,
        data.data_nascimento || null,
        data.localizacao || '',
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

  updatePhoto: (id, foto_url, callback) => {
    db.query(
      'UPDATE User SET foto_url = ? WHERE id = ?',
      [foto_url, id],
      callback
    );
  },

  delete: (id, callback) => {
    db.query('DELETE FROM User WHERE id = ?', [id], callback);
  },

  getInstrumentsByUser: (id, callback) => {
    db.query(
      `SELECT ui.instrumento_id,
              i.nome AS instrumento_nome,
              ui.nivel,
              ui.anos_experiencia
       FROM User_inst ui
      JOIN Instrumento i ON i.id = ui.instrumento_id
      WHERE ui.user_id = ?
      ORDER BY i.nome ASC`,
     [id],
     callback
   );
 },

  getCharacteristicsByUser: (id, callback) => {
    db.query(
      `SELECT uc.caracteristica_id AS id,
              c.nome
       FROM UserCar uc
       JOIN Caracteristica c ON c.id = uc.caracteristica_id
       WHERE uc.user_id = ?
       ORDER BY c.nome ASC`,
      [id],
      callback
    );
  },
};
module.exports = User;
