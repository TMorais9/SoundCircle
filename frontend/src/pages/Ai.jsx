import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./ai.module.css";
import UsersAPI from "../services/usersAPI";
import AiAPI from "../services/aiAPI";

const extractYears = (text) => {
    if (!text) return null;
    const match = text.match(/(\d+)\s*(anos|ano)?/i);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
};

function Ai() {
    const [messages, setMessages] = useState([
        {
            remetente: "ai",
            texto: "Olá 👋 Sou o teu assistente virtual. Diz-me o que procuras para te ajudar!",
            matches: [],
        },
    ]);
    const [inputText, setInputText] = useState("");
    const [instrumento, setInstrumento] = useState("");
    const [anosExperiencia, setAnosExperiencia] = useState("");
    const [localizacao, setLocalizacao] = useState("");
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

    const buildPreferences = () => {
        const selectedTraits = caracteristicasDisponiveis
            .filter((trait) => caracteristicasSelecionadas.includes(trait.id))
            .map((trait) => trait.nome);

        const instrumentoTexto = instrumento.trim() || inputText.trim() || null;
        return {
            instrumento: instrumento.trim() || null,
            anosExperiencia:
                anosExperiencia !== "" ? Number(anosExperiencia) : extractYears(inputText) ?? null,
            localizacao: localizacao.trim() || null,
            caracteristicas: selectedTraits,
            userId: currentUserId,
            instrumentoFallback: instrumentoTexto,
        };
    };

    const formatResponse = (matches, prefs) => {
        if (!matches.length) {
            return "Não encontrei ninguém com esses filtros. Tenta relaxar algum critério ou escolher menos características.";
        }
        const temExato = matches.some((m) => m.exato === true);
        const soAproximado = matches.length > 0 && !temExato;
        const introParts = [];
        if (prefs.instrumento) introParts.push(`instrumento ${prefs.instrumento}`);
        if (prefs.anosExperiencia) introParts.push(`${prefs.anosExperiencia} anos de experiência`);
        if (prefs.localizacao) introParts.push(`perto de ${prefs.localizacao}`);
        if (prefs.caracteristicas?.length) introParts.push(`características: ${prefs.caracteristicas.join(", ")}`);
        const baseIntro =
            introParts.length > 0
                ? `Encontrei ${matches.length} músicos com ${introParts.join(" · ")}:`
                : `Encontrei ${matches.length} músicos compatíveis:`;

        const intro = soAproximado
            ? `Não encontrei exatamente o que pediste, mas tenho sugestões próximas:\n${baseIntro}`
            : baseIntro;

        const bullets = matches
            .map((m) => {
                const role =
                    m.instrumentos?.[0]?.nome ||
                    (m.instrumentos?.length ? m.instrumentos[0].nome : "instrumento não definido");
                const anos = m.instrumentos?.[0]?.anos_experiencia;
                return `• ${m.nome} (${role}${anos ? ` · ${anos} anos` : ""})`;
            })
            .join("\n");

        return `${intro}\n${bullets}\nEscolhe um músico abaixo para ver o perfil.`;
    };

    const handleSend = (e) => {
        e?.preventDefault?.();
        if (loadingMatch) return;

        const prefs = buildPreferences();
        const userText =
            inputText.trim() ||
            `Instrumento: ${prefs.instrumento || "qualquer"}, Anos: ${prefs.anosExperiencia || "qualquer"}, Localização: ${prefs.localizacao || "qualquer"}`;
        const newMessage = { remetente: "user", texto: userText };
        setMessages((prev) => [...prev, newMessage]);
        setInputText("");

        (async () => {
            try {
                setLoadingMatch(true);
                const data = await AiAPI.matchMusicos({
                    instrumento: prefs.instrumento || prefs.instrumentoFallback,
                    anosExperiencia: prefs.anosExperiencia,
                    localizacao: prefs.localizacao,
                    caracteristicas: prefs.caracteristicas,
                    userId: prefs.userId,
                });
                const matches = data?.matches || [];
                const respostaAI = {
                    remetente: "ai",
                    texto: formatResponse(matches, prefs),
                    matches: matches.map((m) => ({ id: m.id, nome: m.nome })),
                };
                setMessages((prev) => [...prev, respostaAI]);
            } catch (error) {
                const respostaAI = {
                    remetente: "ai",
                    texto: error.message || "Não consegui gerar sugestões agora. Tenta mais tarde.",
                    matches: [],
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
                                {msg.matches && msg.matches.length > 0 && (
                                    <div className={styles.aiMatches}>
                                        {msg.matches.map((match) => (
                                            <button
                                                key={match.id}
                                                onClick={() => navigate(`/info/${match.id}`)}
                                            >
                                                Ver {match.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form className={styles.aiInputArea} onSubmit={handleSend}>
                        <div className={styles.filtersPanelInline}>
                            <div className={styles.filterRow}>
                                <div className={styles.filterField}>
                                    <label>Instrumento</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Voz, Guitarra, Piano..."
                                        value={instrumento}
                                        onChange={(e) => setInstrumento(e.target.value)}
                                    />
                                </div>
                                <div className={styles.filterField}>
                                    <label>Anos de experiência</label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Ex: 3"
                                        value={anosExperiencia}
                                        onChange={(e) => setAnosExperiencia(e.target.value)}
                                    />
                                </div>
                                <div className={styles.filterField}>
                                    <label>Localização</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Lisboa, Porto..."
                                        value={localizacao}
                                        onChange={(e) => setLocalizacao(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className={styles.traitsBlock}>
                                <div className={styles.traitsHeader}>
                                    <span>Características</span>
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
                        </div>
                        <div className={styles.textAndButton}>
                            <input
                                type="text"
                                placeholder="Escreve ou reforça o pedido (opcional)..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSend(e);
                                }}
                            />
                            <button type="button" onClick={handleSend} disabled={loadingMatch}>
                                <span className="material-symbols-outlined">
                                    {loadingMatch ? "hourglass_top" : "send"}
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </>
    );
}

export default Ai;
