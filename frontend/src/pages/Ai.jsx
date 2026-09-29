import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./ai.module.css";
import UsersAPI from "../services/usersAPI";
import AiAPI from "../services/aiAPI";

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
    const chatEndRef = useRef(null);
    const navigate = useNavigate();
    const authUser = useAuthUser();

    const currentUserId = useMemo(() => {
        const localId = typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
        return authUser?.id || localId;
    }, [authUser]);

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

    const toggleCaracteristica = (id) => {
        setCaracteristicasSelecionadas((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const formatResponse = (matches, counts = {}) => {
        const exactCount = counts.exactCount ?? matches.filter((m) => m.exato).length;
        const similarCount = counts.similarCount ?? Math.max(0, matches.length - exactCount);

        let intro = "";
        if (!matches.length) {
            intro = "Ainda não tenho músicos suficientes na base de dados para sugerir alguém.";
        } else if (exactCount > 0) {
            intro = `Encontrei ${exactCount} perfis que cumprem exatamente o que pediste.`;
            if (similarCount > 0) {
                intro += ` Também tenho ${similarCount} perfis semelhantes que podem encaixar.`;
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
            const anosTxt = anos || anos === 0 ? `${anos} anos` : "anos n/d";
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

    const normalizeSimples = (texto) =>
        (texto || "")
            .toString()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .trim();

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

    // Na base de dados o "instrumento" de um vocalista é um papel ("Vocalista"),
    // não algo que se "toque" — por isso a frase tem de ser diferente da dos
    // instrumentistas (ex.: "cantam" em vez de "tocam Vocalista").
    const formatDisponibilidadePorInstrumento = (instrumentoUsado) => {
        if (!instrumentoUsado) return "outros músicos disponíveis";
        const norm = normalizeSimples(instrumentoUsado);
        if (PAPEIS_VOCAIS.has(norm)) {
            return "todos os vocalistas disponíveis";
        }
        const nomeInstrumento = PAPEL_PARA_INSTRUMENTO[norm] || instrumentoUsado.toLowerCase();
        return `todos os músicos que tocam ${nomeInstrumento} disponíveis`;
    };

    const formatInterpretado = (interpretado) => {
        if (!interpretado) return "";
        const parts = [];
        if (interpretado.instrumento) parts.push(`instrumento ${interpretado.instrumento}`);
        if (interpretado.localizacao) parts.push(`distrito ${interpretado.localizacao}`);
        if (interpretado.anos_experiencia != null) parts.push(`${interpretado.anos_experiencia} anos de experiência`);
        if (interpretado.caracteristicas?.length) parts.push(`características: ${interpretado.caracteristicas.join(", ")}`);
        return parts.length ? `Percebi que procuras: ${parts.join(" · ")}.` : "";
    };

    const handleSend = (e) => {
        e?.preventDefault?.();
        if (loadingMatch) return;

        const mensagem = texto.trim();
        const selectedTraits = caracteristicasDisponiveis
            .filter((trait) => caracteristicasSelecionadas.includes(trait.id))
            .map((trait) => trait.nome);

        if (!mensagem && selectedTraits.length === 0) return;

        const displayText = mensagem || `Características: ${selectedTraits.join(", ")}`;
        setMessages((prev) => [...prev, { remetente: "user", texto: displayText }]);
        setTexto("");

        (async () => {
            try {
                setLoadingMatch(true);
                const data = await AiAPI.chatMusicos({
                    texto: mensagem,
                    userId: currentUserId,
                    caracteristicas: selectedTraits,
                });
                const matches = data?.matches || [];
                const interpretado = data?.interpretado || {};
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
                    respostaTexto = `Não encontrei ninguém com essas características, nem próximo delas. Aqui tens ${formatDisponibilidadePorInstrumento(data.instrumentoUsado)}.`;
                } else {
                    const entendiLinha = formatInterpretado(interpretado);
                    respostaTexto = entendiLinha ? `${entendiLinha} ${formatted.intro}` : formatted.intro;
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
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form className={styles.aiInputArea} onSubmit={handleSend}>
                        <div className={styles.chatInputRow}>
                            <input
                                type="text"
                                className={styles.chatTextInput}
                                placeholder='Escreve o que procuras... ex: "baterista em Coimbra, 3 anos, pontual e criativo"'
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
