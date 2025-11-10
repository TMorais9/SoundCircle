const User = require('../models/userModel');
const Instrumento = require('../models/instrumentoModel');
const bcrypt = require('bcrypt');

const VALID_LEVELS = ['iniciante', 'intermedio', 'avancado', 'profissional'];

const runQuery = (fn, ...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

const normalizeNivel = (nivel, anosExperiencia) => {
  const lower = (nivel || '').toLowerCase();
  if (VALID_LEVELS.includes(lower)) return lower;
  const anos = Number(anosExperiencia);
  if (!Number.isNaN(anos)) {
    if (anos < 2) return 'iniciante';
    if (anos < 5) return 'intermedio';
    if (anos < 10) return 'avancado';
    return 'profissional';
  }
  return 'intermedio';
};

const linkUserInstrument = async (userId, instrumentName, nivel, anosExperiencia) => {
  const nome = (instrumentName || '').trim();
  if (!userId || !nome) return;

  let instrument = await runQuery(Instrumento.getByName, nome);
  let instrumentoId;
  if (instrument && instrument.length) {
    instrumentoId = instrument[0].id;
  } else {
    const created = await runQuery(Instrumento.create, { nome });
    instrumentoId = created.insertId;
  }

  const finalNivel = normalizeNivel(nivel, anosExperiencia);
  await runQuery(UserInst.upsert, {
    user_id: userId,
    instrumento_id: instrumentoId,
    nivel: finalNivel,
  });
};

const SALT_ROUNDS = 10;

exports.getAll = (req, res) => {
  User.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  User.getById(id, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'User não encontrado' });
    res.json(rows[0]);
  });
};

exports.getProfile = (req, res) => {
  const { id } = req.params;

  User.getById(id, (err, userRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userRows.length) return res.status(404).json({ message: 'User não encontrado' });

    const user = userRows[0];

    User.getInstrumentsByUser(id, (err2, instRows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      res.json({
        user,
        instrumentos: instRows, 
      });
    });
  });
};

exports.create = async (req, res) => {
  try {
    const {
      nome,
      email,
      password,
      tipo,
      descricao,
      foto_url,
      data_nascimento,
      instrumento,
      instrumentoNivel,
      anosExperiencia,
    } = req.body;

    if (!nome || !email || !password || !tipo) {
      return res
        .status(400)
        .json({ message: 'nome, email, password e tipo são obrigatórios' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    User.create(
      { nome, email, password_hash, tipo, descricao, foto_url, data_nascimento },
      async (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Já existe um user com esse email' });
          }
          return res.status(500).json({ error: err.message });
        }
        try {
          await linkUserInstrument(result.insertId, instrumento, instrumentoNivel, anosExperiencia);
        } catch (linkErr) {
          console.error('Erro ao ligar instrumento ao user:', linkErr);
        }
        res.status(201).json({ id: result.insertId, nome, email, tipo });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const {
    nome,
    email,
    tipo,
    descricao,
    foto_url,
    data_nascimento,
    instrumento,
    instrumentoNivel,
    anosExperiencia,
  } = req.body;

  if (!nome || !email || !tipo) {
    return res
      .status(400)
      .json({ message: 'nome, email e tipo são obrigatórios' });
  }

  User.update(
    id,
    { nome, email, tipo, descricao, foto_url, data_nascimento },
    async (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Já existe um user com esse email' });
        }
        return res.status(500).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User não encontrado' });
      }
      try {
        await linkUserInstrument(id, instrumento, instrumentoNivel, anosExperiencia);
      } catch (linkErr) {
        console.error('Erro ao atualizar instrumento do user:', linkErr);
      }
      res.json({ message: 'User atualizado com sucesso' });
    }
  );
};

exports.updatePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password é obrigatória' });
  }

  try {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    User.updatePassword(id, password_hash, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User não encontrado' });
      }
      res.json({ message: 'Password atualizada com sucesso' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ message: 'Email e password são obrigatórios' });

  User.getByEmail(email, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(401).json({ message: 'Credenciais inválidas' });

    const user = rows[0];

    try {
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Credenciais inválidas' });

      res.json({
        id: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;

  User.delete(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User não encontrado' });
    }
    res.json({ message: 'User eliminado com sucesso' });
  });
};
