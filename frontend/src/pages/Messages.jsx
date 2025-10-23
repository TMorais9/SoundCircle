import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Messages.module.css";

function Messages() {
    const [selectedChat, setSelectedChat] = useState(null);
    const [closingChat, setClosingChat] = useState(false);
    const [inputText, setInputText] = useState("");
    const [fadeOutPage, setFadeOutPage] = useState(false);
    const navigate = useNavigate();
    const chatEndRef = useRef(null);

    const mensagens = [
        {
            nome: "Miguel Dias",
            ultimaMensagem: "Olá! Quando é o próximo ensaio?",
            hora: "14:32",
            foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
            chat: [
                { remetente: "Miguel Dias", texto: "Olá! Tudo bem?", hora: "14:20", data: "Ontem" },
                { remetente: "Tu", texto: "Tudo ótimo! E contigo?", hora: "14:25", data: "Ontem" },
                { remetente: "Miguel Dias", texto: "Quando é o próximo ensaio?", hora: "14:32", data: "Ontem" },
            ],
        },
        {
            nome: "Joana Silva",
            ultimaMensagem: "Adorei o concerto de ontem 😍",
            hora: "Ontem",
            foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
            chat: [
                { remetente: "Joana Silva", texto: "Adorei o concerto de ontem 😍", hora: "22:12", data: "Ontem" },
                { remetente: "Tu", texto: "Obrigado Joana! Foi incrível tocar contigo 🎶", hora: "22:15", data: "Ontem" },
            ],
        },
    ];

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

    const handleSend = () => {
        if (!inputText.trim()) return;

        const agora = new Date();
        const hora = agora.toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
        });

        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);

        let data;
        if (agora.toDateString() === hoje.toDateString()) data = "Hoje";
        else if (agora.toDateString() === ontem.toDateString()) data = "Ontem";
        else data = agora.toLocaleDateString("pt-PT");

        const newMessage = { remetente: "Tu", texto: inputText, hora, data };
        setSelectedChat(prev => ({
            ...prev,
            chat: [...prev.chat, newMessage],
        }));

        setInputText("");
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };


    const handleCloseChat = () => {
        setClosingChat(true);
        setTimeout(() => {
            setSelectedChat(null);
            setClosingChat(false);
        }, 350);
    };

    const handleBackHome = () => {
        setFadeOutPage(true);
        setTimeout(() => navigate("/"), 400);
    };

    return (
        <>
            <Header />
            <main className={`${styles.messagesPage} ${fadeOutPage ? styles.fadeOutPage : ""}`}>
                <button
                    className={styles.backButton}
                    onClick={handleBackHome}
                    aria-label="Voltar à Home"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <h1 className={styles.title}>Mensagens</h1>

                <section className={styles.messagesList}>
                    {mensagens.map((msg, index) => (
                        <div
                            key={index}
                            className={styles.messageCard}
                            onClick={() => setSelectedChat(msg)}
                        >
                            <div className={styles.profilePic}>
                                <img src={msg.foto} alt={msg.nome} />
                            </div>
                            <div className={styles.messageInfo}>
                                <h2>{msg.nome}</h2>
                                <p>{msg.ultimaMensagem}</p>
                            </div>
                            <span className={styles.time}>{msg.hora}</span>
                        </div>
                    ))}
                </section>
            </main>

            <Menu />

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
                            {selectedChat.chat.length > 0 && (
                                <div className={styles.dateDivider}>
                                    <span>{selectedChat.chat[selectedChat.chat.length - 1].data || "Anterior"}</span>
                                </div>
                            )}

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
                            <button onClick={handleSend}>
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
