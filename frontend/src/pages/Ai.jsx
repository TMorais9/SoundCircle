// Página do Circle AI: o chat onde o utilizador escreve o que procura.
// A página não decide nada sobre os resultados. Envia o pedido ao backend, que corre o algoritmo CSP
// (backend/ai/ai.py), e depois só transforma a resposta em frases e cartões.
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./ai.module.css";
import UsersAPI from "../services/usersAPI";
import AiAPI from "../services/aiAPI";

// Junta uma lista à portuguesa: "a, b e c".
const juntarLista = (itens) => {
    if (itens.length <= 1) return itens.join("");
    return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
};

// Agrupa nomes repetidos: ["Guitarrista", "Guitarrista"] fica ["Guitarrista (2)"].
const contarIguais = (nomes) => {
    const contagem = new Map();
    nomes.forEach((nome) => contagem.set(nome, (contagem.get(nome) || 0) + 1));
    return [...contagem].map(([nome, n]) => (n > 1 ? `${nome} (${n})` : nome));
};

// Número com a palavra no singular ou no plural ("1 ano", "3 anos").
const quantidade = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// Plural simples de um instrumento, para as mensagens de faltas.
const pluralInstrumento = (nome) => (/[aeiou]$/i.test(nome) ? `${nome}s` : nome);

function Ai() {
    const [messages, setMessages] = useState([
        {
            remetente: "ai",
            texto: "Olá 👋 Sou o teu assistente virtual. Diz-me o que procuras!",
            matches: [],
        },
    ]);
    const [texto, setTexto] = useState("");
    const [caracteristicasDisponiveis, setCaracteristicasDisponiveis] = useState([]);
    const [caracteristicasSelecionadas, setCaracteristicasSelecionadas] = useState([]);
    const [loadingMatch, setLoadingMatch] = useState(false);
    const [loadError, setLoadError] = useState("");
    // Banda que está a ser montada na conversa. O backend devolve-a em cada resposta e nós mandamo-la
    // de volta na mensagem seguinte, para "sou de Coimbra" ou "já tenho baterista" continuarem a mesma banda.
    const [contextoBanda, setContextoBanda] = useState(null);
    const chatEndRef = useRef(null);
    const navigate = useNavigate();
    const authUser = useAuthUser();

    // Id de quem tem sessão iniciada. O backend usa-o para ir buscar o perfil e para nunca te sugerir a ti próprio.
    const currentUserId = useMemo(() => {
        const localId = typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
        return authUser?.id || localId;
    }, [authUser]);

    // Carrega as características do catálogo para os chips.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await UsersAPI.listCaracteristicas();
                if (!mounted) return;
                setCaracteristicasDisponiveis(Array.isArray(data) ? data : []);
                setLoadError("");
            } catch (error) {
                if (!mounted) return;
                setLoadError(error.message || "Não consegui carregar características.");
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Liga e desliga um chip de característica.
    const toggleCaracteristica = (id) => {
        setCaracteristicasSelecionadas((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // Frase e cartões para a procura de um músico. O rótulo (exato, semelhante ou outra opção) vem do nível
    // de relaxamento em que o CSP encontrou as soluções.
    const formatResponse = (matches, counts = {}) => {
        const exactCount = counts.exactCount ?? matches.filter((m) => m.exato).length;
        const similarCount = counts.similarCount ?? Math.max(0, matches.length - exactCount);

        let intro = "";
        if (!matches.length) {
            intro = "Ainda não tenho músicos suficientes na base de dados para sugerir alguém.";
        } else if (exactCount > 0) {
            intro = `Encontrei ${quantidade(exactCount, "perfil que cumpre", "perfis que cumprem")} exatamente o que pediste.`;
            if (similarCount > 0) {
                intro += ` Também tenho ${quantidade(similarCount, "perfil semelhante que pode encaixar", "perfis semelhantes que podem encaixar")}.`;
            }
        } else {
            intro = "Não encontrei ninguém que cumpra exatamente esses critérios, mas estes são os perfis mais próximos que tenho.";
        }

        const listItems = matches.map((m) => {
            const role =
                m.instrumento_escolhido ||
                m.instrumentos?.[0]?.nome ||
                (m.instrumentos?.length ? m.instrumentos[0].nome : "instrumento não definido");
            const anos =
                m.instrumento_anos ??
                m.instrumentos?.[0]?.anos_experiencia;
            const anosTxt = anos || anos === 0 ? quantidade(anos, "ano", "anos") : "anos n/d";
            const modo = m.exato ? "exato" : m.proximo === false ? "outra opção" : "semelhante";

            const roleNorm = role?.toLowerCase() || "";
            const isBanda = roleNorm.includes("banda");
            const displayRole = isBanda ? "Banda" : role || "instrumento n/d";

            const metaParts = [];
            if (displayRole) metaParts.push(displayRole);
            if (anosTxt) metaParts.push(anosTxt);
            if (!isBanda && m.localizacao) metaParts.push(m.localizacao);

            return {
                id: m.id,
                nome: m.nome,
                metaParts,
                modo,
            };
        });

        return { intro, listItems };
    };

    // Cartões das bandas já formadas que o CSP encontrou para o utilizador integrar.
    const formatBandasExistentes = (bandas) =>
        bandas.map((banda) => ({
            id: banda.id,
            nome: banda.nome,
            modo: banda.exato ? "exata" : banda.proximo === false ? "outra opção" : "semelhante",
            metaParts: ["Banda", banda.localizacao, banda.desde ? `desde ${banda.desde}` : null].filter(Boolean),
        }));

    // Cartões das bandas propostas. Cada membro é um lugar (uma variável) da solução do CSP.
    // "Tu" e "Já tens" são os lugares que ficaram com os valores especiais tu e ocupado.
    const formatBandas = (bandas) =>
        bandas.map((banda, idx) => ({
            chave: `${idx}-${banda.membros.map((m) => m.id ?? m.papel).join("-")}`,
            titulo: `Proposta ${idx + 1}`,
            modo: banda.exato ? "exata" : banda.proximo === false ? "outra opção" : "semelhante",
            membros: banda.membros.map((m, posicao) => {
                const chave = `${posicao}-${m.papel}`;
                if (m.ocupado) {
                    return { chave, papel: m.papel, nome: "Já tens", metaParts: ["lugar ocupado"], tipo: "ocupado" };
                }
                const anos = m.instrumento_anos;
                const metaParts = [anos || anos === 0 ? quantidade(anos, "ano", "anos") : "anos n/d"];
                if (m.localizacao) metaParts.push(m.localizacao);
                if (m.tu) return { chave, papel: m.papel, nome: "Tu", metaParts, tipo: "tu" };
                return { chave, id: m.id, nome: m.nome, papel: m.papel, metaParts, tipo: "musico" };
            }),
        }));

    // Normaliza texto (minúsculas, sem acentos) para comparar nomes de instrumentos.
    const normalizeSimples = (texto) =>
        (texto || "")
            .toString()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .trim();

    // Para escrever "músicos que tocam bateria" a partir de "baterista".
    const PAPEL_PARA_INSTRUMENTO = {
        guitarrista: "guitarra",
        guitarra: "guitarra",
        baixista: "baixo",
        baixo: "baixo",
        baterista: "bateria",
        bateria: "bateria",
        pianista: "piano",
        piano: "piano",
    };

    const PAPEIS_VOCAIS = new Set(["vocalista", "voz", "cantor", "cantora"]);

    // Texto usado quando nenhum músico é próximo do pedido e mostramos todos os desse instrumento.
    const formatDisponibilidadePorInstrumento = (instrumentoUsado) => {
        if (!instrumentoUsado) return "outros músicos disponíveis";
        const norm = normalizeSimples(instrumentoUsado);
        if (PAPEIS_VOCAIS.has(norm)) {
            return "todos os vocalistas disponíveis";
        }
        const nomeInstrumento = PAPEL_PARA_INSTRUMENTO[norm] || instrumentoUsado.toLowerCase();
        return `todos os músicos que tocam ${nomeInstrumento} disponíveis`;
    };

    // Frase "Percebi que procuras: ..." com o que o algoritmo percebeu do pedido.
    const formatInterpretado = (preferencias, procuraBandaFormada = false) => {
        if (!preferencias) return "";
        const parts = procuraBandaFormada ? ["uma banda já formada"] : [];
        const instrumentos = preferencias.instrumentos?.length
            ? preferencias.instrumentos
            : preferencias.instrumento
                ? [preferencias.instrumento]
                : [];
        if (instrumentos.length > 1) parts.push(`banda com ${juntarLista(contarIguais(instrumentos))}`);
        else if (instrumentos.length === 1) parts.push(`instrumento ${instrumentos[0]}`);
        if (preferencias.localizacao) parts.push(`distrito ${preferencias.localizacao}`);
        if (preferencias.anos_experiencia != null) parts.push(`${preferencias.anos_experiencia} anos de experiência`);
        if (preferencias.caracteristicas?.length) parts.push(`características: ${preferencias.caracteristicas.join(", ")}`);
        return parts.length ? `Percebi que procuras: ${parts.join(" · ")}.` : "";
    };

    // Explica uma falta detetada pelo CSP: há menos pessoas do que lugares para um instrumento.
    const descreverFalta = (falta) => {
        const nome = falta.instrumento.toLowerCase();
        if (!falta.disponiveis) return `não há nenhum ${nome} disponível`;
        const disponiveis = quantidade(falta.disponiveis, nome, pluralInstrumento(nome));
        return `só há ${disponiveis} para ${falta.pedidos} lugares`;
    };

    // Texto da resposta quando o utilizador procura uma banda para integrar.
    const respostaBandasExistentes = (data) => {
        const bandas = data.bandas || [];
        let resposta;
        if (!bandas.length) {
            resposta = "Ainda não há bandas registadas no SoundCircle.";
        } else if (data.exactCount > 0) {
            resposta = `Encontrei ${quantidade(data.exactCount, "banda que cumpre", "bandas que cumprem")} exatamente o que pediste.`;
            if (data.similarCount > 0) {
                resposta += ` Também tenho ${quantidade(data.similarCount, "banda semelhante", "bandas semelhantes")}.`;
            }
        } else if (data.semNenhumProximo) {
            resposta = "Não encontrei nenhuma banda com essas características, nem próxima. Aqui tens as bandas registadas.";
        } else {
            resposta = "Não encontrei nenhuma banda que cumpra exatamente esses critérios, mas estas são as mais próximas.";
        }
        return `${formatInterpretado(data.preferenciasEfetivas, true)} ${resposta}`;
    };

    // Tira da frase "Percebi que procuras" os instrumentos e o distrito do perfil, porque isso já foi dito antes.
    const semPlano = (preferencias) => ({
        ...preferencias,
        instrumento: null,
        instrumentos: [],
        localizacao: preferencias.do_perfil?.localizacao ? null : preferencias.localizacao,
    });

    // Explica a banda: o que veio do perfil, o que já tens e que lugares faltam. Os lugares são as variáveis do CSP.
    const explicarFormacao = (data) => {
        const preferencias = data.preferenciasEfetivas || {};
        const lugares = preferencias.lugares || [];
        const doPerfil = preferencias.do_perfil || {};
        const frases = [];
        const vindoDoPerfil = [...(doPerfil.instrumentos || []), doPerfil.localizacao].filter(Boolean);
        if (vindoDoPerfil.length) frases.push(`Fui buscar ao teu perfil: ${vindoDoPerfil.join(" · ")}.`);

        const nomes = (tipo) => lugares.filter((l) => l.tipo === tipo).map((l) => l.papel.toLowerCase());
        const livres = nomes("livre");
        if (lugares.length === livres.length) return frases.join(" ");

        const teus = doPerfil.instrumentos?.length ? [] : nomes("tu");
        const ocupados = nomes("ocupado");
        const partes = [];
        if (teus.length) partes.push(`Na banda já estás tu (${juntarLista(teus)})`);
        if (ocupados.length) partes.push(`${partes.length ? "já tens" : "Já tens"} ${juntarLista(ocupados)}`);
        const tem = partes.join(" e ");
        if (!livres.length) {
            frases.push(tem ? `${tem}, por isso não falta ninguém da formação base.` : "Já não falta ninguém da formação base.");
        } else {
            const faltam = `${livres.length === 1 ? "falta" : "faltam"} ${juntarLista(contarIguais(livres))}`;
            frases.push(tem ? `${tem}; ${faltam}.` : `${faltam.charAt(0).toUpperCase()}${faltam.slice(1)}.`);
        }
        return frases.join(" ");
    };

    // Junta frases, saltando as que vierem vazias.
    const juntarFrases = (...frases) => frases.filter(Boolean).join(" ");

    // Diz se o único critério do pedido é o distrito (para escolher a frase mais simples).
    const soLocalizacao = (preferencias) =>
        !!preferencias.localizacao && !preferencias.caracteristicas?.length && preferencias.anos_experiencia == null;

    // Para os lugares em que o CSP ficou sem candidatos (domínio vazio), diz o instrumento e que foi escolhido o mais próximo.
    const explicarSemCandidatos = (papeis, preferencias) => {
        const lista = juntarLista(papeis.map((papel) => papel.toLowerCase()));
        const um = papeis.length === 1;
        return soLocalizacao(preferencias)
            ? `Para ${lista} não há ninguém em ${preferencias.localizacao} nem perto, por isso escolhi ${um ? "o mais próximo" : "os mais próximos"}.`
            : `Para ${lista} não há ninguém que cumpra o que pediste, por isso escolhi ${um ? "o que mais se aproxima" : "os que mais se aproximam"}.`;
    };

    // Texto da resposta quando se forma uma banda.
    const respostaFormarBanda = (data) => {
        const preferencias = data.preferenciasEfetivas || {};
        if (data.semInstrumentos) {
            const formacao = explicarFormacao(data);
            if ((preferencias.lugares || []).length) {
                return juntarFrases(formacao, 'Se precisares de mais alguém, diz-me quem, por exemplo: "e um pianista".');
            }
            return juntarFrases(
                formacao,
                formatInterpretado(semPlano(preferencias)),
                'Para formar a banda, diz-me que instrumento tocas ou que músicos te faltam, por exemplo: "sou guitarrista" ou "baterista e baixista". Também podes pôr os teus instrumentos no teu perfil.'
            );
        }
        const bandas = data.bandas || [];
        let resposta;
        if (!bandas.length) {
            const faltas = data.faltas || [];
            resposta = faltas.length
                ? `Não consigo formar essa banda: ${juntarLista(faltas.map(descreverFalta))}.`
                : "Não consigo formar essa banda: não há músicos diferentes suficientes para todos os lugares.";
        } else if (data.exactCount > 0) {
            resposta = `Encontrei ${quantidade(data.exactCount, "banda possível que cumpre", "bandas possíveis que cumprem")} exatamente o que pediste.`;
            if (data.similarCount > 0) {
                resposta += ` Também tenho ${quantidade(data.similarCount, "combinação semelhante", "combinações semelhantes")}.`;
            }
        } else if (data.papeisSemCandidatos?.length) {
            resposta = explicarSemCandidatos(data.papeisSemCandidatos, preferencias);
        } else if (data.semNenhumProximo) {
            resposta = "Não consegui juntar uma banda que cumpra tudo o que pediste; estas combinações respeitam só os instrumentos.";
        } else {
            resposta = "Nenhuma banda cumpre tudo exatamente; estas são as combinações mais próximas.";
        }
        const formacao = explicarFormacao(data);
        const base = formacao ? semPlano(preferencias) : preferencias;
        const localJaDito = bandas.length > 0 && !data.exactCount && data.papeisSemCandidatos?.length && soLocalizacao(preferencias);
        const entendiLinha = formatInterpretado(localJaDito ? { ...base, localizacao: null } : base);
        return juntarFrases(formacao, entendiLinha, resposta);
    };

    // Envia a mensagem com o texto, os chips escolhidos, o id do utilizador e o contexto da conversa.
    const handleSend = (e) => {
        e?.preventDefault?.();
        if (loadingMatch) return;

        const mensagem = texto.trim();
        const selectedTraits = caracteristicasSelecionadas
            .map((id) => caracteristicasDisponiveis.find((trait) => trait.id === id)?.nome)
            .filter(Boolean);

        if (!mensagem && selectedTraits.length === 0) return;

        const displayText = [mensagem, selectedTraits.length ? `Características: ${selectedTraits.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · ");
        setMessages((prev) => [...prev, { remetente: "user", texto: displayText }]);
        setTexto("");
        setCaracteristicasSelecionadas([]);

        (async () => {
            try {
                setLoadingMatch(true);
                // o backend corre o algoritmo CSP e devolve o resultado
                const data = await AiAPI.chatMusicos({
                    texto: mensagem,
                    userId: currentUserId,
                    caracteristicas: selectedTraits,
                    contexto: contextoBanda,
                });
                // guardamos o contexto para a próxima mensagem (fica vazio quando já não estamos a montar uma banda)
                setContextoBanda(data?.contexto || null);

                // a forma de mostrar depende do tipo de problema que o algoritmo resolveu
                if (data?.modo === "formar_banda") {
                    setMessages((prev) => [
                        ...prev,
                        { remetente: "ai", texto: respostaFormarBanda(data), bandas: formatBandas(data.bandas || []) },
                    ]);
                    return;
                }

                if (data?.modo === "bandas_existentes") {
                    setMessages((prev) => [
                        ...prev,
                        {
                            remetente: "ai",
                            texto: respostaBandasExistentes(data),
                            listItems: formatBandasExistentes(data.bandas || []),
                        },
                    ]);
                    return;
                }

                const matches = data?.matches || [];
                const counts = {
                    exactCount: data?.exactCount ?? matches.filter((m) => m.exato).length,
                    similarCount: data?.similarCount ?? 0,
                };
                const formatted = formatResponse(matches, counts);

                let respostaTexto;
                if (data?.message) {
                    respostaTexto = data.message;
                } else if (data?.entendiNada) {
                    respostaTexto =
                        "Não percebi bem instrumento, distrito, anos de experiência ou características no que escreveste, mas aqui tens alguns músicos para começares a explorar.";
                } else if (data?.semNenhumProximo) {
                    respostaTexto = juntarFrases(
                        formatInterpretado(data.preferenciasEfetivas),
                        `Não encontrei ninguém com essas características, nem próximo delas. Aqui tens ${formatDisponibilidadePorInstrumento(data.instrumentoUsado)}.`
                    );
                } else {
                    const entendiLinha = formatInterpretado(data?.preferenciasEfetivas || data?.interpretado);
                    respostaTexto = juntarFrases(entendiLinha, formatted.intro);
                }

                const respostaAI = {
                    remetente: "ai",
                    texto: respostaTexto,
                    listItems: formatted.listItems,
                    matches: matches.map((m) => ({ id: m.id, nome: m.nome })),
                };
                setMessages((prev) => [...prev, respostaAI]);
            } catch (error) {
                const respostaAI = {
                    remetente: "ai",
                    texto: error.message || "Não consegui perceber o teu pedido agora. Tenta reformular.",
                    matches: [],
                    listItems: [],
                };
                setMessages((prev) => [...prev, respostaAI]);
            } finally {
                setLoadingMatch(false);
                setTimeout(() => {
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 50);
            }
        })();
    };

    // Interface: mensagens, cartões com os resultados e a caixa de texto com os chips.
    return (
        <>
            <main className={styles.aiPage}>
                <div className={styles.aiContainer}>
                    <div className={styles.messagesArea}>
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={
                                    msg.remetente === "user"
                                        ? styles.userMessage
                                        : styles.aiMessage
                                }
                            >
                                <p>{msg.texto}</p>
                                {msg.listItems && msg.listItems.length > 0 && (
                                    <ul className={styles.matchesList}>
                                        {msg.listItems.map((item) => (
                                            <li key={item.id} className={styles.matchItem}>
                                                <div className={styles.matchLine}>
                                                    <span className={styles.matchName}>{item.nome}</span>
                                                    <span className={styles.matchTag}>{item.modo}</span>
                                                </div>
                                                <div className={styles.matchMeta}>
                                                    {item.metaParts?.map((part, idx) => (
                                                        <span key={idx}>{part}</span>
                                                    ))}
                                                </div>
                                                <button onClick={() => navigate(`/info/${item.id}`)}>
                                                    Ver perfil
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {msg.bandas && msg.bandas.length > 0 && (
                                    <ul className={styles.bandsList}>
                                        {msg.bandas.map((banda) => (
                                            <li key={banda.chave} className={styles.bandItem}>
                                                <div className={styles.matchLine}>
                                                    <span className={styles.matchName}>{banda.titulo}</span>
                                                    <span className={styles.matchTag}>{banda.modo}</span>
                                                </div>
                                                <ul className={styles.bandMembers}>
                                                    {banda.membros.map((membro) => (
                                                        <li
                                                            key={membro.chave}
                                                            className={`${styles.bandMember} ${membro.tipo !== "musico" ? styles.bandMemberFixo : ""}`}
                                                        >
                                                            <span className={styles.memberRole}>{membro.papel}</span>
                                                            <div className={styles.memberInfo}>
                                                                <span className={styles.matchName}>{membro.nome}</span>
                                                                <div className={styles.matchMeta}>
                                                                    {membro.metaParts.map((part, idx) => (
                                                                        <span key={idx}>{part}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {membro.tipo === "musico" && (
                                                                <button type="button" onClick={() => navigate(`/info/${membro.id}`)}>
                                                                    Ver perfil
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form className={styles.aiInputArea} onSubmit={handleSend}>
                        <div className={styles.chatInputRow}>
                            <input
                                type="text"
                                className={styles.chatTextInput}
                                placeholder={
                                    contextoBanda
                                        ? 'Continua a tua banda... ex: "sou de Coimbra", "já tenho baterista" ou "e um pianista"'
                                        : 'Escreve o que procuras... ex: "baterista em Coimbra, 3 anos", "sou guitarrista e quero formar uma banda" ou "procuro uma banda de rock"'
                                }
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                            />
                        </div>
                        <div className={styles.traitsBlock}>
                            <div className={styles.traitsHeader}>
                                <span>Características (opcional, clica para adicionar ao pedido)</span>
                                {loadError && <small className={styles.errorText}>{loadError}</small>}
                            </div>
                            <div className={styles.traitsChips}>
                                {caracteristicasDisponiveis.map((trait) => (
                                    <button
                                        key={trait.id}
                                        type="button"
                                        className={`${styles.traitChip} ${
                                            caracteristicasSelecionadas.includes(trait.id)
                                                ? styles.traitChipActive
                                                : ""
                                        }`}
                                        onClick={() => toggleCaracteristica(trait.id)}
                                    >
                                        {trait.nome}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.textAndButton}>
                            <button type="submit" disabled={loadingMatch}>
                                {loadingMatch ? "A procurar..." : "Enviar"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </>
    );
}

export default Ai;
