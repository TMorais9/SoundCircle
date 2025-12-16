import { useState, useRef, useEffect, useMemo, Fragment } from "react";
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
    const fileInputRef = useRef(null);

    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [pendingTarget, setPendingTarget] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [lightboxMedia, setLightboxMedia] = useState(null);

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

    const resolveMediaUrl = (value) => {
        if (!value) return null;
        if (value.startsWith("http") || value.startsWith("blob:") || value.startsWith("data:")) return value;
        if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
        return `${API_BASE_URL}/${value}`;
    };

    const detectMediaType = (path) => {
        if (!path) return null;
        const lower = path.toLowerCase();
        if (lower.match(/\.(mp4|mov|webm|ogg|avi|mkv)$/)) return "video";
        if (lower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) return "imagem";
        return null;
    };

    const getMessagePreview = (msg) => {
        const tipo = msg.media_tipo || msg.mediaTipo;
        if (msg.conteudo || msg.texto) return msg.conteudo || msg.texto;
        if (tipo === "imagem") return "📷 Imagem";
        if (tipo === "video") return "🎥 Vídeo";
        return "Mensagem";
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
                mediaPath: resolveMediaUrl(msg.media_path),
                mediaTipo: msg.media_tipo || detectMediaType(msg.media_path),
                hora,
                data,
                timestamp: msg.data_envio,
            });
            convMap[otherId].ultimaMensagem = getMessagePreview(msg);
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

    const clearSelectedFile = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSend = async () => {
        if (!selectedChat || !currentUserId || sending) return;
        const texto = inputText.trim();
        if (!texto && !selectedFile) return;
        const now = new Date();
        const timestamp = now.toISOString();
        const { hora, data } = formatTimestamp(timestamp);
        const localId = `temp-${timestamp}`;
        const outgoing = {
            localId,
            remetenteId: Number(currentUserId),
            remetente: "Tu",
            texto,
            mediaPath: selectedFile ? previewUrl : null,
            mediaTipo: selectedFile
                ? selectedFile.type.startsWith("video/")
                    ? "video"
                    : "imagem"
                : null,
            hora,
            data,
            timestamp,
            pending: !!selectedFile,
        };

        setInputText("");
        setSending(true);
        setSelectedChat((prev) =>
            prev
                ? {
                      ...prev,
                      chat: [...prev.chat, outgoing],
                      ultimaMensagem: getMessagePreview(outgoing),
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
                              ultimaMensagem: getMessagePreview(outgoing),
                              hora: data === "Hoje" ? hora : data,
                          }
                        : conv
                )
            )
        );
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

        try {
            if (selectedFile) {
                const formData = new FormData();
                formData.append("remetente_id", Number(currentUserId));
                formData.append("destinatario_id", selectedChat.userId);
                if (texto) formData.append("conteudo", texto);
                formData.append("media", selectedFile);

                const response = await MessagesAPI.sendMedia(formData);
                const confirmedPath = resolveMediaUrl(response?.media_path);
                const confirmedTipo = response?.media_tipo || outgoing.mediaTipo || detectMediaType(response?.media_path);

                const applyServerMedia = (chatList) =>
                    chatList.map((msg) =>
                        msg.localId === localId
                            ? { ...msg, mediaPath: confirmedPath || msg.mediaPath, mediaTipo: confirmedTipo, pending: false }
                            : msg
                    );

                setSelectedChat((prev) =>
                    prev
                        ? {
                              ...prev,
                              chat: applyServerMedia(prev.chat),
                              ultimaMensagem: getMessagePreview({ ...outgoing, mediaTipo: confirmedTipo }),
                          }
                        : prev
                );
                setConversations((prev) =>
                    sortConversations(
                        prev.map((conv) =>
                            conv.userId === selectedChat.userId
                                ? {
                                      ...conv,
                                      chat: applyServerMedia(conv.chat),
                                      ultimaMensagem: getMessagePreview({ ...outgoing, mediaTipo: confirmedTipo }),
                                  }
                                : conv
                        )
                    )
                );
            } else {
                await MessagesAPI.send({
                    remetente_id: Number(currentUserId),
                    destinatario_id: selectedChat.userId,
                    conteudo: texto,
                });
            }
        } catch (err) {
            setError(err.message || "Não foi possível enviar a mensagem");
            setSelectedChat((prev) =>
                prev
                    ? {
                          ...prev,
                          chat: prev.chat.filter((msg) => msg.localId !== localId),
                      }
                    : prev
            );
            setConversations((prev) =>
                sortConversations(
                    prev.map((conv) =>
                        conv.userId === selectedChat.userId
                            ? { ...conv, chat: conv.chat.filter((msg) => msg.localId !== localId) }
                            : conv
                    )
                )
            );
        } finally {
            setSending(false);
            clearSelectedFile();
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
        setSelectedChat(null);
        setInputText("");
        clearSelectedFile();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
            setError("Apenas imagens ou vídeos são suportados.");
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError("");
    };

    const renderChatMessages = () => {
        let lastDate = null;
        return selectedChat.chat.map((msg, i) => {
            const dateLabel = msg.data || formatTimestamp(msg.timestamp).data;
            const showDivider = dateLabel !== lastDate;
            if (showDivider) lastDate = dateLabel;

            return (
                <Fragment key={`${msg.timestamp || i}-${i}`}>
                    {showDivider && (
                        <div className={styles.dateDivider}>
                            <span>{dateLabel}</span>
                        </div>
                    )}
                    <div
                        className={`${styles.chatMessage} ${msg.remetente === "Tu" ? styles.sent : styles.received
                            }`}
                    >
                        {msg.mediaPath && (
                            <button
                                type="button"
                                className={styles.chatMedia}
                                onClick={() => openLightbox(msg.mediaPath, msg.mediaTipo)}
                            >
                                {msg.mediaTipo === "video" ? (
                                    <video src={msg.mediaPath} controls preload="metadata" />
                                ) : (
                                    <img src={msg.mediaPath} alt="Anexo" />
                                )}
                            </button>
                        )}
                        {msg.texto && <p className={msg.mediaPath ? styles.textAfterMedia : ""}>{msg.texto}</p>}
                        <span>{msg.hora}</span>
                    </div>
                </Fragment>
            );
        });
    };

    const openLightbox = (src, tipo) => {
        if (!src) return;
        setLightboxMedia({ src, tipo });
    };

    const closeLightbox = () => setLightboxMedia(null);

    return (
        <>
            <main className={styles.messagesPage}>
                <div className={styles.messagesContainer}>
                    <h1 className={styles.title}>Mensagens</h1>

                    {!selectedChat && (
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
                    )}

                    {selectedChat && (
                        <div className={styles.chatPanel}>
                            <div className={styles.chatHeader}>
                                <button className={styles.backButton} onClick={handleCloseChat} aria-label="Voltar">
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <img src={selectedChat.foto} alt={selectedChat.nome} />
                                <h2>{selectedChat.nome}</h2>
                            </div>

                            <div className={styles.chatBody}>
                                {renderChatMessages()}

                                <div ref={chatEndRef} />
                            </div>

                            {selectedFile && (
                                <div className={styles.mediaPreview}>
                                    <div className={styles.mediaThumb}>
                                        {previewUrl && selectedFile.type.startsWith("video/") ? (
                                            <video src={previewUrl} muted playsInline />
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.previewButton}
                                                onClick={() => openLightbox(previewUrl, "imagem")}
                                            >
                                                <img src={previewUrl || "https://via.placeholder.com/80"} alt="Pré-visualização" />
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.mediaInfo}>
                                        <p>{selectedFile.name}</p>
                                        <button onClick={clearSelectedFile}>Remover</button>
                                    </div>
                                </div>
                            )}

                            <div className={styles.chatInputArea}>
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    ref={fileInputRef}
                                    className={styles.hiddenFileInput}
                                    onChange={handleFileChange}
                                />
                                <button
                                    className={styles.attachButton}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={sending}
                                    title="Anexar foto ou vídeo"
                                >
                                    <span className="material-symbols-outlined">attach_file</span>
                                </button>
                                <input
                                    type="text"
                                    placeholder="Escreve uma mensagem..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                />
                                <button className={styles.sendButton} onClick={handleSend} disabled={sending}>
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {lightboxMedia && (
                <div className={styles.lightboxOverlay} onClick={closeLightbox}>
                    <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.lightboxClose} onClick={closeLightbox} aria-label="Fechar">
                            ✕
                        </button>
                        {lightboxMedia.tipo === "video" ? (
                            <video src={lightboxMedia.src} controls autoPlay />
                        ) : (
                            <img src={lightboxMedia.src} alt="Visualização ampliada" />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default Messages;
