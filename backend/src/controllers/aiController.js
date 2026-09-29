const path = require('path');
const { spawn } = require('child_process');
const User = require('../models/userModel');
const Instrumento = require('../models/instrumentoModel');
const Caracteristica = require('../models/caracteristicaModel');

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
      const parsed = Number(anos);
      const anosNum =
        Number.isFinite(parsed) && `${anos ?? ''}`.trim() !== '' ? parsed : null;
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
    .filter((row) => (row.tipo || '').toLowerCase() !== 'banda')
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

const runPythonScript = (payload) =>
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
        if (parsed && parsed.resultados) return resolve(parsed);
        return reject(new Error('Resposta inválida do matcher'));
      } catch (err) {
        return reject(new Error(`Falha a ler saída do matcher: ${err.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });

const runPythonMatcher = (musicos, preferencias) =>
  runPythonScript({ musicos, preferencias, max_resultados: 10 }).then((parsed) => parsed.resultados);

const canonicalizeInstrument = (raw) => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return null;
  const norm = trimmed.toLowerCase();
  const aliases = {
    pianista: 'piano',
    piano: 'piano',
    baixista: 'baixo',
    baixo: 'baixo',
    guitarrista: 'guitarra',
    guitarra: 'guitarra',
    baterista: 'bateria',
    bateria: 'bateria',
    vocalista: 'voz',
    cantor: 'voz',
    cantora: 'voz',
    voz: 'voz',
  };
  return aliases[norm] || trimmed;
};

const enrichMatch = (m) => {
  const instrumentos = Array.isArray(m.instrumentos) ? m.instrumentos : [];
  const firstInst = instrumentos[0] || {};
  return {
    ...m,
    instrumentos,
    instrumento_escolhido: m.instrumento_escolhido || firstInst.nome || null,
    instrumento_anos:
      m.instrumento_anos ??
      (Number.isFinite(firstInst.anos_experiencia) ? firstInst.anos_experiencia : null),
  };
};

// Usado pelo chat: confia sempre na ordenação/pontuação que já vem do motor
// CSP (backend/ai/ai.py), sem voltar a filtrar por thresholds. O motor já
// garante que, mesmo sem nenhum músico a cumprir os critérios, devolve os
// mais parecidos — por isso aqui nunca descartamos esses resultados.
const buildChatResults = (resultados, maxTotal = 8) => {
  const ordenados = resultados.slice(0, maxTotal).map(enrichMatch);
  const exactCount = ordenados.filter((r) => r.exato).length;
  return {
    matches: ordenados,
    exactCount,
    similarCount: ordenados.length - exactCount,
  };
};

const classifyMatches = (resultados, preferencias) => {
  const onlyInstrument =
    !!preferencias.instrumento &&
    preferencias.anos_experiencia == null &&
    !preferencias.localizacao &&
    (!preferencias.caracteristicas || preferencias.caracteristicas.length === 0);

  const filtrados = onlyInstrument
    ? resultados.filter((r) => r.instrumento_match === true || (r.instrumento_score ?? 0) >= 0.78)
    : resultados;

  const normalizados = filtrados.map((r) => {
    const instOk =
      !preferencias.instrumento ||
      r.instrumento_match === true ||
      (r.instrumento_score ?? 0) >= 0.75;

    const anosStrict =
      preferencias.anos_experiencia == null ||
      (r.anos_diff != null && Number(r.anos_diff) === 0);

    const anosRelax =
      preferencias.anos_experiencia == null ||
      r.anos_diff == null ||
      Number(r.anos_diff) <= 4;

    const locStrict =
      !preferencias.localizacao ||
      (r.localizacao_ratio ?? 0) >= 0.85;

    const locRelax =
      !preferencias.localizacao ||
      (r.localizacao_ratio ?? 0) >= 0.7;

    const shouldBeExact =
      (onlyInstrument && instOk) ||
      (instOk && anosStrict && locStrict);

    if (shouldBeExact) {
      return { ...r, exato: true, instrumento_match: true };
    }

    return {
      ...r,
      _instOk: instOk,
      _anosRelax: anosRelax,
      _locRelax: locRelax,
    };
  });

  const exatos = normalizados.filter((r) => r.exato);

  const similares = normalizados
    .filter((r) => !exatos.includes(r))
    .filter((r) => {
      const instOk = r._instOk ?? (!preferencias.instrumento || r.instrumento_match === true || (r.instrumento_score ?? 0) >= 0.75);
      const anosOk =
        (r._anosRelax ?? false) ||
        preferencias.anos_experiencia == null ||
        (r.anos_diff != null && Number(r.anos_diff) <= 4);
      const locOk =
        (r._locRelax ?? false) ||
        !preferencias.localizacao ||
        (r.localizacao_ratio ?? 0) >= 0.7;
      return instOk && anosOk && locOk;
    })
    .slice(0, 5);

  const matches = [...exatos, ...similares];
  const enrichedMatches = matches.map(enrichMatch);

  return {
    matches: enrichedMatches,
    exactCount: onlyInstrument ? enrichedMatches.length : exatos.length,
    similarCount: onlyInstrument ? 0 : similares.length,
  };
};

exports.match = async (req, res) => {
  const {
    instrumento,
    anosExperiencia,
    localizacao,
    caracteristicas,
    userId,
    instrumentos_requeridos,
    banda,
    requisitos_por_instrumento,
    politica_localizacao_banda,
  } = req.body || {};

  try {
    const rows = await runQuery(User.getAllWithDetails);
    const musicos = buildMusicians(rows, userId);

    if (!musicos.length) {
      return res.status(200).json({ matches: [], message: 'Ainda não existem músicos suficientes na base de dados.' });
    }

    const parsedYears = Number(anosExperiencia);
    const instrumentosReqRaw =
      instrumentos_requeridos ||
      (banda && (banda.instrumentos || banda.instrumentos_requeridos)) ||
      [];
    const instrumentos_reqs = Array.isArray(instrumentosReqRaw)
      ? instrumentosReqRaw.filter(Boolean).map(canonicalizeInstrument)
      : [];

    const requisitosPorInstrumento = requisitos_por_instrumento || (banda && banda.requisitos_por_instrumento) || {};
    const politicaBanda =
      politica_localizacao_banda || (banda && banda.politica_localizacao_banda) || undefined;

    const preferencias = {
      instrumento: canonicalizeInstrument(instrumento || null),
      anos_experiencia:
        Number.isFinite(parsedYears) && `${anosExperiencia ?? ''}`.trim() !== ''
          ? parsedYears
          : null,
      localizacao: localizacao || null,
      caracteristicas: Array.isArray(caracteristicas) ? caracteristicas : [],
      instrumentos_requeridos: instrumentos_reqs,
      requisitos_por_instrumento: requisitosPorInstrumento,
      politica_localizacao_banda: politicaBanda,
    };

    const resultados = await runPythonMatcher(musicos, preferencias);
    const { matches: enrichedMatches, exactCount, similarCount } = classifyMatches(resultados, preferencias);

    if (enrichedMatches.length === 0) {
      return res.status(200).json({
        matches: [],
        message: 'Não encontrei nada com essas características, tenta relaxar as tuas exigências.',
      });
    }

    return res.json({ matches: enrichedMatches, exactCount, similarCount });
  } catch (err) {
    console.error('Erro no matcher AI:', err.message);
    return res.status(500).json({ error: 'Não foi possível gerar sugestões com o motor AI', detail: err.message });
  }
};

exports.chat = async (req, res) => {
  const { texto, userId, instrumento, anosExperiencia, localizacao, caracteristicas } = req.body || {};

  const mensagem = typeof texto === 'string' ? texto.trim() : '';

  // filtros manuais (opcionais, ex.: chips de características) têm sempre
  // prioridade sobre o que for extraído do texto livre
  const parsedYears = Number(anosExperiencia);
  const preferenciasExplicitas = {
    instrumento: canonicalizeInstrument(instrumento || null),
    anos_experiencia:
      Number.isFinite(parsedYears) && `${anosExperiencia ?? ''}`.trim() !== '' ? parsedYears : null,
    localizacao: localizacao || null,
    caracteristicas: Array.isArray(caracteristicas) && caracteristicas.length ? caracteristicas : null,
  };

  const temFiltroExplicito =
    !!preferenciasExplicitas.instrumento ||
    !!preferenciasExplicitas.localizacao ||
    preferenciasExplicitas.anos_experiencia != null ||
    !!preferenciasExplicitas.caracteristicas;

  if (!mensagem && !temFiltroExplicito) {
    return res.status(400).json({ error: 'Escreve o que procuras, ou escolhe pelo menos uma característica, para eu poder ajudar.' });
  }

  try {
    const [rows, instrumentosDb, caracteristicasDb] = await Promise.all([
      runQuery(User.getAllWithDetails),
      runQuery(Instrumento.getAll),
      runQuery(Caracteristica.getAll),
    ]);

    const musicos = buildMusicians(rows, userId);

    if (!musicos.length) {
      return res.status(200).json({ matches: [], message: 'Ainda não existem músicos suficientes na base de dados.' });
    }

    const instrumentos_conhecidos = instrumentosDb.map((i) => i.nome).filter(Boolean);
    const caracteristicas_conhecidas = caracteristicasDb.map((c) => c.nome).filter(Boolean);

    const parsed = await runPythonScript({
      musicos,
      texto: mensagem,
      preferencias: preferenciasExplicitas,
      instrumentos_conhecidos,
      caracteristicas_conhecidas,
      max_resultados: 10,
    });

    const resultados = parsed.resultados || [];
    const interpretado = parsed.interpretado || {};
    const preferenciasEfetivas = parsed.preferencias_efetivas || {};

    const entendiNada =
      !temFiltroExplicito &&
      !interpretado.instrumento &&
      !interpretado.localizacao &&
      interpretado.anos_experiencia == null &&
      (!interpretado.caracteristicas || interpretado.caracteristicas.length === 0);

    // O motor CSP (ai.py) garante sempre os candidatos mais parecidos, mesmo
    // que nenhum cumpra exatamente os critérios, por isso só fica vazio se
    // não houver músicos de todo (já tratado acima).
    const { matches: enrichedMatches, exactCount, similarCount } = buildChatResults(resultados);

    // Se nenhum resultado é sequer "próximo" (ai.py só chega aqui quando não
    // há correspondência nem relaxada), o motor ancorou no instrumento
    // pedido para não mostrar músicos sem qualquer relação com o pedido.
    const semNenhumProximo =
      !entendiNada && enrichedMatches.length > 0 && enrichedMatches.every((m) => m.proximo === false);

    const instrumentoUsado =
      preferenciasEfetivas.instrumento || interpretado.instrumento || preferenciasExplicitas.instrumento || null;

    return res.json({
      matches: enrichedMatches,
      exactCount,
      similarCount,
      interpretado,
      entendiNada,
      semNenhumProximo,
      instrumentoUsado,
    });
  } catch (err) {
    console.error('Erro no chat AI:', err.message);
    return res.status(500).json({ error: 'Não foi possível gerar sugestões com o motor AI', detail: err.message });
  }
};
