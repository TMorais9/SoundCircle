const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const Instrumento = require('../models/instrumentoModel');
const UserInst = require('../models/userInstModel');

const VALID_LEVELS = ['iniciante', 'intermedio', 'avancado', 'profissional'];

const runQuery = (fn, ...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

const normalizeAnosExperiencia = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return null;
};

const normalizeNivel = (nivel, anosExperiencia) => {
  const lower = (nivel || '').toLowerCase();
  if (VALID_LEVELS.includes(lower)) return lower;

  const normalizedYears = normalizeAnosExperiencia(anosExperiencia);
  if (normalizedYears !== null) {
    if (normalizedYears < 2) return 'iniciante';
    if (normalizedYears < 5) return 'intermedio';
    if (normalizedYears < 10) return 'avancado';
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
    anos_experiencia: normalizeAnosExperiencia(anosExperiencia),
  });
};

const SALT_ROUNDS = 10;
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PUBLIC_UPLOAD_PREFIX = '/uploads';

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

ensureUploadsDir();

const deleteUploadedFile = (storedPath) => {
  if (!storedPath) return;

  const resolveAbsolutePath = () => {
    if (storedPath.startsWith(PUBLIC_UPLOAD_PREFIX)) {
      const relative = storedPath.replace(/^\//, '');
      return path.join(__dirname, '..', relative);
    }
    if (storedPath.startsWith(UPLOADS_DIR)) {
      return storedPath;
    }
    return null;
  };

  const absolutePath = resolveAbsolutePath();
  if (!absolutePath) return;

  fs.unlink(absolutePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Falha ao remover foto antiga:', err.message);
    }
  });
};

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

exports.getProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const userRows = await runQuery(User.getById, id);
    if (!userRows.length) return res.status(404).json({ message: 'User não encontrado' });

    const instrumentos = await runQuery(User.getInstrumentsByUser, id);
    let caracteristicas = [];
    try {
      caracteristicas = await runQuery(User.getCharacteristicsByUser, id);
    } catch (carErr) {
      console.error('Erro ao obter características do user:', carErr.message);
    }

    res.json({
      user: userRows[0],
      instrumentos,
      caracteristicas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      nome,
      email,
      password,
      tipo,
      sexo,
      descricao,
      foto_url,
      data_nascimento,
      localizacao,
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
      { nome, email, password_hash, tipo, sexo, descricao, foto_url, data_nascimento, localizacao },
      async (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Já existe um user com esse email' });
          }
          console.error('Erro a criar utilizador:', err);
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
    sexo,
    descricao,
    foto_url,
    data_nascimento,
    localizacao,
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
    { nome, email, tipo, sexo, descricao, foto_url, data_nascimento, localizacao },
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
      console.error('Payload recebido no registo:', req.body);
    }
  });
};

exports.uploadPhoto = (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum ficheiro enviado' });
  }

  const tempFilePath = req.file.path || path.join(UPLOADS_DIR, req.file.filename);

  User.getById(id, (err, rows) => {
    if (err) {
      deleteUploadedFile(tempFilePath);
      return res.status(500).json({ error: err.message });
    }
    if (!rows.length) {
      deleteUploadedFile(tempFilePath);
      return res.status(404).json({ message: 'User não encontrado' });
    }

    const oldPhoto = rows[0].foto_url;
    const publicUrl = `${PUBLIC_UPLOAD_PREFIX}/${req.file.filename}`;

    User.updatePhoto(id, publicUrl, (updateErr) => {
      if (updateErr) {
        deleteUploadedFile(tempFilePath);
        return res.status(500).json({ error: updateErr.message });
      }
      if (oldPhoto && oldPhoto !== publicUrl) {
        deleteUploadedFile(oldPhoto);
      }
      res.json({ url: publicUrl });
    });
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
