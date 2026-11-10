// Controller da parte de AI.
// Não faz a procura: vai buscar os dados à base de dados, prepara-os no formato que o algoritmo espera,
// chama o script Python (backend/ai/ai.py), onde está o CSP, e devolve a resposta ao frontend.
const path = require('path');
const { spawn } = require('child_process');
const User = require('../models/userModel');
const Instrumento = require('../models/instrumentoModel');
const Caracteristica = require('../models/caracteristicaModel');

// Transforma as funções dos models (que usam callbacks) em promessas, para podermos usar await.
const runQuery = (fn, ...args) =>
  new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

// Os instrumentos vêm da base de dados numa só string ("Guitarrista::10::profissional||...").
// Aqui passam a uma lista de objetos com nome, anos de experiência e nível.
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

// As características também vêm numa só string, separadas por ||.
const parseCaracteristicas = (raw) => {
  if (!raw) return [];
  return raw.split('||').filter(Boolean);
};

// Lista de músicos que entra no CSP (é o domínio das variáveis).
// Ficam de fora o próprio utilizador e as contas de banda. Os anos de experiência gerais são os do
// instrumento com menos anos, para não exagerar a experiência de ninguém.
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

// Perfil de quem está a pedir: instrumentos, distrito e características.
// O algoritmo usa-o ao formar uma banda (os teus lugares, a localização e a afinidade com os outros).
const buildProfile = (rows, userId) => {
  if (!userId) return null;
  const row = rows.find((r) => Number(r.id) === Number(userId));
  if (!row) return null;
  const [perfil] = buildMusicians([row]);
  return perfil || null;
};

// Contas do tipo banda, usadas quando o utilizador quer entrar numa banda já formada.
const buildBands = (rows, ignoreUserId) =>
  rows
    .filter((row) => !ignoreUserId || Number(row.id) !== Number(ignoreUserId))
    .filter((row) => (row.tipo || '').toLowerCase() === 'banda')
    .map((row) => {
      const fundacao = row.data_nascimento ? new Date(row.data_nascimento) : null;
      return {
        id: row.id,
        nome: row.nome,
        localizacao: row.localizacao,
        caracteristicas: parseCaracteristicas(row.caracteristicas_raw),
        instrumentos: [],
        desde: fundacao && !Number.isNaN(fundacao.getTime()) ? fundacao.getFullYear() : null,
      };
    });

// Corre o algoritmo: lança o ai.py, envia o pedido em JSON pelo stdin e lê a resposta no stdout.
// Se o Python falhar ou devolver algo inválido, o erro passa para quem chamou.
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

// Normaliza o nome de um instrumento enviado explicitamente ("baterista" e "bateria" ficam iguais).
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
    violinista: 'violino',
    violino: 'violino',
    saxofonista: 'saxofone',
    saxofone: 'saxofone',
    teclista: 'teclado',
    teclado: 'teclado',
  };
  return aliases[norm] || trimmed;
};

// Garante que cada músico devolvido tem o nome e os anos do instrumento, para a página mostrar.
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

// Conta quantos resultados são exatos e quantos semelhantes. A ordem é a que o CSP devolveu.
const buildChatResults = (resultados, maxTotal = 8) => {
  const ordenados = resultados.slice(0, maxTotal).map(enrichMatch);
  const exactCount = ordenados.filter((r) => r.exato).length;
  return {
    matches: ordenados,
    exactCount,
    similarCount: ordenados.length - exactCount,
  };
};

// POST /ai/match: pesquisa com filtros explícitos (instrumento, anos, distrito, características ou lista de instrumentos para uma banda).
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

    // o CSP decide tudo, incluindo o rótulo exato/semelhante de cada resultado
    const parsed = await runPythonScript({
      musicos,
      preferencias,
      perfil: buildProfile(rows, userId),
      max_resultados: 8,
    });
    if (parsed.modo === 'formar_banda') {
      return res.json({ modo: 'formar_banda', bandas: parsed.resultados, faltas: parsed.faltas || [] });
    }
    const { matches: enrichedMatches, exactCount, similarCount } = buildChatResults(parsed.resultados);

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

// POST /ai/chat: o chat da página Circle AI.
// Recebe o texto, os chips de características, o id do utilizador e o contexto da conversa (a banda que
// está a ser montada), e devolve músicos, bandas para integrar ou propostas de banda.
exports.chat = async (req, res) => {
  const { texto, userId, instrumento, anosExperiencia, localizacao, caracteristicas, contexto } = req.body || {};

  const mensagem = typeof texto === 'string' ? texto.trim() : '';

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

  // sem texto e sem chips não há nada para procurar
  if (!mensagem && !temFiltroExplicito) {
    return res.status(400).json({ error: 'Escreve o que procuras, ou escolhe pelo menos uma característica, para eu poder ajudar.' });
  }

  try {
    // dados que o algoritmo precisa: utilizadores (músicos e bandas) e os catálogos de instrumentos e características
    const [rows, instrumentosDb, caracteristicasDb] = await Promise.all([
      runQuery(User.getAllWithDetails),
      runQuery(Instrumento.getAll),
      runQuery(Caracteristica.getAll),
    ]);

    const musicos = buildMusicians(rows, userId);
    const bandas = buildBands(rows, userId);

    if (!musicos.length && !bandas.length) {
      return res.status(200).json({ matches: [], message: 'Ainda não existem músicos suficientes na base de dados.' });
    }

    // o algoritmo reconhece no texto os instrumentos do catálogo e também os que os músicos registaram (ex.: Violino)
    const instrumentos_conhecidos = [
      ...new Set([
        ...instrumentosDb.map((i) => i.nome),
        ...musicos.flatMap((m) => m.instrumentos.map((i) => i.nome)),
      ].filter(Boolean)),
    ];
    const caracteristicas_conhecidas = caracteristicasDb.map((c) => c.nome).filter(Boolean);

    // aqui corre o algoritmo: interpreta a frase, monta o CSP certo e resolve-o
    const parsed = await runPythonScript({
      musicos,
      bandas,
      texto: mensagem,
      preferencias: preferenciasExplicitas,
      instrumentos_conhecidos,
      caracteristicas_conhecidas,
      perfil: buildProfile(rows, userId),
      max_resultados: 8,
      max_bandas: 5,
      contexto: contexto && typeof contexto === 'object' ? contexto : null,
    });

    const resultados = parsed.resultados || [];
    const interpretado = parsed.interpretado || {};
    const preferenciasEfetivas = parsed.preferencias_efetivas || {};

    // resposta para bandas (formar uma nova ou integrar uma existente)
    if (parsed.modo === 'formar_banda' || parsed.modo === 'bandas_existentes') {
      const exactBandas = resultados.filter((b) => b.exato).length;
      return res.json({
        modo: parsed.modo,
        bandas: resultados,
        exactCount: exactBandas,
        similarCount: resultados.length - exactBandas,
        semNenhumProximo: resultados.length > 0 && resultados.every((b) => b.proximo === false),
        semInstrumentos: !!parsed.sem_instrumentos,
        faltas: parsed.faltas || [],
        papeisSemCandidatos: parsed.papeis_sem_candidatos || [],
        interpretado,
        preferenciasEfetivas,
        contexto: parsed.contexto || null,
        entendiNada: false,
      });
    }

    // resposta para a procura de um músico; entendiNada serve para avisar quando a frase não tinha nada reconhecível
    const entendiNada =
      !parsed.contexto &&
      !temFiltroExplicito &&
      !interpretado.instrumento &&
      !interpretado.localizacao &&
      interpretado.anos_experiencia == null &&
      (!interpretado.caracteristicas || interpretado.caracteristicas.length === 0);

    const { matches: enrichedMatches, exactCount, similarCount } = buildChatResults(resultados);

    const semNenhumProximo =
      !entendiNada && enrichedMatches.length > 0 && enrichedMatches.every((m) => m.proximo === false);

    const instrumentoUsado =
      preferenciasEfetivas.instrumento || interpretado.instrumento || preferenciasExplicitas.instrumento || null;

    return res.json({
      modo: 'musico',
      matches: enrichedMatches,
      exactCount,
      similarCount,
      interpretado,
      preferenciasEfetivas,
      entendiNada,
      semNenhumProximo,
      instrumentoUsado,
      contexto: parsed.contexto || null,
    });
  } catch (err) {
    console.error('Erro no chat AI:', err.message);
    return res.status(500).json({ error: 'Não foi possível gerar sugestões com o motor AI', detail: err.message });
  }
};
