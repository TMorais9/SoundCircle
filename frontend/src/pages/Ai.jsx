import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Ai.module.css";

function Ai() {
    const [messages, setMessages] = useState([
        { remetente: "ai", texto: "Olá 👋 Sou a tua assistente virtual. Em que posso ajudar?" },
    ]);
    const [inputText, setInputText] = useState("");
    const chatEndRef = useRef(null);
    const navigate = useNavigate();

    const handleSend = (e) => {
        // Impede o Enter de dar “submit” e recarregar a página
        e?.preventDefault?.();
        if (!inputText.trim()) return;

        const newMessage = { remetente: "user", texto: inputText };
        const respostaAI = {
            remetente: "ai",
            texto: `Interessante! Disseste: "${inputText}" 🤔`,
        };

        setMessages((prev) => [...prev, newMessage, respostaAI]);
        setInputText("");

        // Mantém o scroll dentro da área de mensagens
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
