import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./messages.module.css";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";
import MessagesAPI from "../services/messagesAPI";

function Messages() {
    const navigate = useNavigate();
    const location = useLocation();
    const authUser = useAuthUser();
    const chatEndRef = useRef(null);

    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [closingChat, setClosingChat] = useState(false);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [pendingTarget, setPendingTarget] = useState(null);

    const currentUserId = useMemo(() => {
        const localId = typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
        return authUser?.id || localId;
    }, [authUser]);

    const formatarHoraEData = () => {
        const agora = new Date();
        const hora = agora.toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
        });

        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);

        if (agora.toDateString() === hoje.toDateString()) return { hora, data: "Hoje" };
        if (agora.toDateString() === ontem.toDateString()) return { hora, data: "Ontem" };
        return { hora, data: agora.toLocaleDateString("pt-PT") };
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return formatarHoraEData();
        const date = new Date(timestamp);
        const hora = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);
        let data;
        if (date.toDateString() === hoje.toDateString()) data = "Hoje";
        else if (date.toDateString() === ontem.toDateString()) data = "Ontem";
        else data = date.toLocaleDateString("pt-PT");
        return { hora, data };
    };

    const resolvePhotoUrl = (value) => {
        if (!value) return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
        if (value.startsWith("http") || value.startsWith("data:")) return value;
        if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
        return value;
    };

    const buildConversations = (messages, usersMap) => {
        const convMap = {};
        const myId = Number(currentUserId);

        messages.forEach((msg) => {
            const otherId = msg.remetente_id === myId ? msg.destinatario_id : msg.remetente_id;
            if (!otherId) return;
            if (!convMap[otherId]) {
                const otherUser = usersMap[otherId] || {};
                convMap[otherId] = {
                    userId: otherId,
                    nome: otherUser.nome || `Utilizador ${otherId}`,
                    foto: resolvePhotoUrl(otherUser.foto_url),
                    chat: [],
                    ultimaMensagem: "",
                    hora: "",
                };
            }
            const { hora, data } = formatTimestamp(msg.data_envio);
            convMap[otherId].chat.push({
                remetenteId: msg.remetente_id,
                remetente: msg.remetente_id === myId ? "Tu" : convMap[otherId].nome,
                texto: msg.conteudo,
                hora,
                data,
                timestamp: msg.data_envio,
            });
            convMap[otherId].ultimaMensagem = msg.conteudo;
            convMap[otherId].hora = data === "Hoje" ? hora : data;
        });

        return Object.values(convMap).map((conv) => ({
            ...conv,
            chat: conv.chat.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        }));
    };

    const sortConversations = (list) =>
        [...list].sort((a, b) => {
            const aLast = a.chat[a.chat.length - 1]?.timestamp || 0;
            const bLast = b.chat[b.chat.length - 1]?.timestamp || 0;
            return new Date(bLast) - new Date(aLast);
        });

    useEffect(() => {
        if (!currentUserId) {
            setError("Precisas de iniciar sessão para ver as mensagens.");
            setLoading(false);
            return;
        }

        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const [usersList, messageList] = await Promise.all([
                    UsersAPI.listUsers(),
                    MessagesAPI.listByUser(currentUserId),
                ]);
                if (!mounted) return;
                const usersMap = {};
                (usersList || []).forEach((user) => {
                    usersMap[user.id] = user;
                });
                const convArray = sortConversations(buildConversations(messageList || [], usersMap));
                setConversations(convArray);
                setError("");
                const params = new URLSearchParams(location.search);
                const target = params.get("user");
                let pending = pendingTarget;
                if (!pending && location.state?.targetUser) {
                    pending = location.state.targetUser;
                    setPendingTarget(pending);
                    navigate(location.pathname + location.search, { replace: true, state: {} });
                }
                if (target || pending) {
                    const targetId = pending?.id || target;
                    const found = convArray.find((c) => Number(c.userId) === Number(targetId));
                    if (found) {
                        openConversation(found);
                    } else if (pending) {
                        openConversation({
                            userId: Number(pending.id),
                            nome: pending.nome || `Utilizador ${pending.id}`,
                            foto: resolvePhotoUrl(pending.foto),
                            chat: [],
                            ultimaMensagem: "",
                            hora: "",
                        });
                    }
                    if (pendingTarget) {
                        setPendingTarget(null);
                    }
                }
            } catch (err) {
                if (!mounted) return;
                setError(err.message || "Não foi possível carregar as mensagens");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [currentUserId, location.search]);

    useEffect(() => {
        if (selectedChat) {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    }, [selectedChat]);

    const handleSend = async () => {
        if (!inputText.trim() || !selectedChat || !currentUserId) return;
        const texto = inputText.trim();
        const now = new Date();
        const { hora, data } = formatTimestamp(now.toISOString());
        const outgoing = {
            remetenteId: Number(currentUserId),
            remetente: "Tu",
            texto,
            hora,
            data,
            timestamp: now.toISOString(),
        };

        setInputText("");
        setSending(true);
        setSelectedChat((prev) =>
            prev
                ? {
                      ...prev,
                      chat: [...prev.chat, outgoing],
                      ultimaMensagem: texto,
                      hora: data === "Hoje" ? hora : data,
                  }
                : prev
        );
        setConversations((prev) =>
            sortConversations(
                prev.map((conv) =>
                    conv.userId === selectedChat.userId
                        ? {
                              ...conv,
                              chat: [...conv.chat, outgoing],
                              ultimaMensagem: texto,
                              hora: data === "Hoje" ? hora : data,
                          }
                        : conv
                )
            )
        );
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

        try {
            await MessagesAPI.send({
                remetente_id: Number(currentUserId),
                destinatario_id: selectedChat.userId,
                conteudo: texto,
            });
        } catch (err) {
            setError(err.message || "Não foi possível enviar a mensagem");
        } finally {
            setSending(false);
        }
    };


    const openConversation = (conv) => {
        setSelectedChat({
            ...conv,
            chat: [...conv.chat],
        });
        setInputText("");
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const handleCloseChat = () => {
        setClosingChat(true);
        setTimeout(() => {
            setSelectedChat(null);
            setClosingChat(false);
            setInputText("");
        }, 350);
    };

    return (
        <>
            <main className={styles.messagesPage}>

                <h1 className={styles.title}>Mensagens</h1>

                <section className={styles.messagesList}>
                    {loading ? (
                        <p className={styles.statusMessage}>A carregar conversas...</p>
                    ) : error ? (
                        <p className={styles.errorMessage}>{error}</p>
                    ) : conversations.length ? (
                        conversations.map((conv) => (
                            <div
                                key={conv.userId}
                                className={styles.messageCard}
                                onClick={() => openConversation(conv)}
                            >
                                <div className={styles.profilePic}>
                                    <img src={conv.foto} alt={conv.nome} />
                                </div>
                                <div className={styles.messageInfo}>
                                    <h2>{conv.nome}</h2>
                                    <p>{conv.ultimaMensagem || "Ainda sem mensagens"}</p>
                                </div>
                                <span className={styles.time}>{conv.hora || ""}</span>
                            </div>
                        ))
                    ) : (
                        <p className={styles.statusMessage}>
                            Ainda não tens mensagens. Envia a primeira para começar uma conversa!
                        </p>
                    )}
                </section>
            </main>

            {selectedChat && (
                <div className={`${styles.chatModalOverlay} ${closingChat ? styles.fadeOut : ""}`}>
                    <div className={styles.chatModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.chatHeader}>
                            <img src={selectedChat.foto} alt={selectedChat.nome} />
                            <h2>{selectedChat.nome}</h2>
                            <button className={styles.closeChat} onClick={handleCloseChat}>
                                ✕
                            </button>
                        </div>

                            <div className={styles.chatBody}>
                                {selectedChat.chat.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`${styles.chatMessage} ${msg.remetente === "Tu" ? styles.sent : styles.received
                                            }`}
                                    >
                                        <p>{msg.texto}</p>
                                        <span>{msg.hora}</span>
                                    </div>
                                ))}

                                <div ref={chatEndRef} />
                            </div>


                        <div className={styles.chatInputArea}>
                            <input
                                type="text"
                                placeholder="Escreve uma mensagem..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            />
                            <button onClick={handleSend} disabled={sending}>
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Messages;
