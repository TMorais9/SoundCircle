import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Ai.module.css";
import UsersAPI from "../services/usersAPI";

const PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const toDateInputValue = (value) => {
    if (!value) return "";
    return value.split("T")[0];
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const [year, month, day] = toDateInputValue(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
};

const calcularIdade = (data) => {
    const nascimento = parseDateOnly(data);
    if (!nascimento) return null;
    const diff = Date.now() - nascimento.getTime();
    return new Date(diff).getUTCFullYear() - 1970;
};

function Ai() {
    const [messages, setMessages] = useState([
        {
            remetente: "ai",
            texto: "Olá 👋 Sou o teu assistente virtual. Diz-me o que procuras!",
            matches: [],
        },
    ]);
    const [inputText, setInputText] = useState("");
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
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
                setLoadingUsers(true);
                const data = await UsersAPI.listUsers();
                if (!mounted) return;
                const list = Array.isArray(data) ? data : [];
                const filtered = currentUserId
                    ? list.filter((user) => Number(user.id) !== Number(currentUserId))
                    : list;
                setUsers(filtered);
                setLoadError("");
            } catch (error) {
                if (!mounted) return;
                setLoadError(error.message || "Não consegui aceder à base de dados de músicos.");
            } finally {
                if (mounted) setLoadingUsers(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [currentUserId]);

    const EXPERIENCE_SYNONYMS = {
        iniciante: ["iniciante", "principiante", "começar", "novo"],
        intermedio: ["intermedio", "médio", "medio"],
        avancado: ["avançado", "avancado", "experiente", "experiência"],
        profissional: ["profissional", "experiência alta", "muito experiente", "top"],
    };

    const normalizeNivel = (value = "") => {
        const lower = value.toLowerCase();
        if (lower.includes("inic")) return "iniciante";
        if (lower.includes("inter")) return "intermedio";
        if (lower.includes("avanç") || lower.includes("avanc")) return "avancado";
        if (lower.includes("prof")) return "profissional";
        return value;
    };

    const detectNivelRequest = (text) => {
        const lower = text.toLowerCase();
        for (const [nivel, keywords] of Object.entries(EXPERIENCE_SYNONYMS)) {
            if (keywords.some((key) => lower.includes(key))) {
                return nivel;
            }
        }
        return null;
    };

    const parseInstrumentDetails = (user) => {
        if (user.instrumentos_detalhes) {
            return user.instrumentos_detalhes.split("||").map((entry) => {
                const [nome, nivel] = entry.split("::").map((item) => item?.trim());
                return { nome, nivel };
            });
        }
        const instrumentos = user.instrumentos
            ? user.instrumentos.split(",").map((nome) => ({ nome: nome.trim(), nivel: "" }))
            : [];
        return instrumentos.length
            ? instrumentos
            : user.instrumento_nome
                ? [{ nome: user.instrumento_nome, nivel: user.instrumento_nivel }]
                : [];
    };

    const detectInstrumentRequest = (text) => {
        const lower = text.toLowerCase();
        const instrumentHits = new Set();
        users.forEach((user) => {
            parseInstrumentDetails(user).forEach(({ nome }) => {
                if (!nome) return;
                if (lower.includes(nome.toLowerCase())) {
                    instrumentHits.add(nome);
                }
            });
        });
        return instrumentHits.size ? [...instrumentHits][0] : null;
    };

    const buildAnswer = (query) => {
        if (loadingUsers) {
            return "Ainda estou a carregar a lista de músicos. Dá-me só mais uns segundos!";
        }
        if (loadError) {
            return `Não consigo aceder aos perfis agora: ${loadError}`;
        }
        if (!users.length) {
            return "Ainda não existem músicos registados para sugerir. Convida alguém para se juntar! 😉";
        }

        const nivel = detectNivelRequest(query) || null;
        const instrumento = detectInstrumentRequest(query) || null;

        if (!instrumento && !nivel) {
            return "Não existem músicos compatíveis com o que procuras.";
        }

        let filtered = [...users];
        if (instrumento) {
            const lower = instrumento.toLowerCase();
            filtered = filtered.filter((user) => {
                const detalhes = parseInstrumentDetails(user);
                return detalhes.some(({ nome }) => nome && nome.toLowerCase().includes(lower));
            });
        }

        if (nivel) {
            filtered = filtered.filter((user) => {
                const detalhes = parseInstrumentDetails(user);
                if (detalhes.length) {
                    return detalhes.some(({ nivel: lvl }) => normalizeNivel(lvl || "") === nivel);
                }
                const nivelUser = normalizeNivel(user.instrumento_nivel || "");
                if (nivel === "avancado") return nivelUser === "avancado" || nivelUser === "profissional";
                return nivelUser === nivel;
            });
        }

        if (!filtered.length) {
            const misses = [];
            if (instrumento) misses.push(`instrumento "${instrumento}"`);
            if (nivel) misses.push(`nível ${nivel}`);
            const reason = misses.length ? misses.join(" e ") : "esses critérios";
            return `Não encontrei ninguém com ${reason}. Tenta relaxar as condições ou experimenta outro instrumento.`;
        }

        const topMatches = filtered.slice(0, 3);
        const introParts = [];
        if (instrumento) introParts.push(`instrumento ${instrumento}`);
        if (nivel) introParts.push(`nível ${nivel}`);
        const intro =
            introParts.length > 0
                ? `Encontrei ${topMatches.length} músico(s) com ${introParts.join(" e ")}:`
                : `Aqui tens alguns músicos que podes gostar:`;

        const bullets = topMatches
            .map((user) => {
                const idade = user.data_nascimento ? `${calcularIdade(user.data_nascimento)} anos` : "idade não definida";
                const detalhes = parseInstrumentDetails(user);
                const principal = detalhes[0];
                const role =
                    principal?.nome ||
                    user.instrumento_nome ||
                    (user.instrumentos ? user.instrumentos.split(",")[0] : "artista");
                const nivelUser = normalizeNivel(principal?.nivel || user.instrumento_nivel || "");
                return `• ${user.nome} (${idade}, ${role}${nivelUser ? ` · ${nivelUser}` : ""})`;
            })
            .join("\n");

        const matches = topMatches.map((user) => ({ id: user.id, nome: user.nome }));
        return {
            texto: `${intro}\n${bullets}\nEscolhe um músico abaixo para abrires o perfil.`,
            matches,
        };
    };

    const handleSend = (e) => {
        e?.preventDefault?.();
        if (!inputText.trim()) return;

        const newMessage = { remetente: "user", texto: inputText };
        const resultado = buildAnswer(inputText);
        const respostaAI =
            typeof resultado === "string"
                ? { remetente: "ai", texto: resultado, matches: [] }
                : {
                      remetente: "ai",
                      texto: resultado.texto,
                      matches: resultado.matches || [],
                  };

        setMessages((prev) => [...prev, newMessage, respostaAI]);
        setInputText("");

        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
    };

    const handleBack = () => navigate("/");

    return (
        <>
            <Header />
            <main className={styles.aiPage}>
                <button
                    className={styles.backButton}
                    onClick={handleBack}
                    aria-label="Voltar à Home"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
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

                    {/* Área de input */}
                    <form
                        className={styles.aiInputArea}
                        onSubmit={handleSend} // evita submit da página
                    >
                        <input
                            type="text"
                            placeholder="Escreve a tua pergunta..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSend(e);
                            }}
                        />
                        <button type="button" onClick={handleSend}>
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </form>
                </div>
            </main>

            <Menu />
        </>
    );
}

export default Ai;
