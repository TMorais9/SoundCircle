const path = require('path');
const { spawn } = require('child_process');
const User = require('../models/userModel');

const runQuery = (fn, ...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

const parseInstrumentos = (raw) => {
  if (!raw) return [];
  return raw
    .split('||')
    .map((item) => {
      const [nome, anos, nivel] = item.split('::');
      const anosNum = Number.isFinite(Number(anos)) ? Number(anos) : null;
      return {
        nome: (nome || '').trim(),
        anos_experiencia: anosNum,
        nivel: (nivel || '').trim(),
      };
    })
    .filter((inst) => inst.nome);
};

const parseCaracteristicas = (raw) => {
  if (!raw) return [];
  return raw.split('||').filter(Boolean);
};

const buildMusicians = (rows, ignoreUserId) =>
  rows
    .filter((row) => !ignoreUserId || Number(row.id) !== Number(ignoreUserId))
    .map((row) => {
      const instrumentos = parseInstrumentos(row.instrumentos_raw);
      const anosList = instrumentos
        .map((i) => i.anos_experiencia)
        .filter((val) => Number.isFinite(val));
      const anos_experiencia =
        anosList.length > 0 ? Math.min(...anosList) : null;
      return {
        id: row.id,
        nome: row.nome,
        localizacao: row.localizacao,
        instrumentos,
        caracteristicas: parseCaracteristicas(row.caracteristicas_raw),
        anos_experiencia,
      };
    });

const runPythonMatcher = (musicos, preferencias) =>
  new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const scriptPath = path.join(__dirname, '..', '..', 'ai', 'ai.py');

    const child = spawn(pythonBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `Python matcher saiu com código ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && parsed.resultados) return resolve(parsed.resultados);
        return reject(new Error('Resposta inválida do matcher'));
      } catch (err) {
        return reject(new Error(`Falha a ler saída do matcher: ${err.message}`));
      }
    });

    child.stdin.write(
      JSON.stringify({
        musicos,
        preferencias,
        max_resultados: 5,
      })
    );
    child.stdin.end();
  });

exports.match = async (req, res) => {
  const { instrumento, anosExperiencia, localizacao, caracteristicas, userId } = req.body || {};

  try {
    const rows = await runQuery(User.getAllWithDetails);
    const musicos = buildMusicians(rows, userId);

    if (!musicos.length) {
      return res.status(200).json({ matches: [], message: 'Ainda não existem músicos suficientes na base de dados.' });
    }

    const preferencias = {
      instrumento: instrumento || null,
      anos_experiencia: Number.isFinite(Number(anosExperiencia)) ? Number(anosExperiencia) : null,
      localizacao: localizacao || null,
      caracteristicas: Array.isArray(caracteristicas) ? caracteristicas : [],
    };

    const resultados = await runPythonMatcher(musicos, preferencias);
    return res.json({ matches: resultados });
  } catch (err) {
    console.error('Erro no matcher AI:', err.message);
    return res.status(500).json({ error: 'Não foi possível gerar sugestões com o motor AI', detail: err.message });
  }
};
