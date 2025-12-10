import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./home.module.css";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";

const PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const resolvePhotoUrl = (value) => {
    if (!value) return PLACEHOLDER;
    if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://"))
        return value;
    if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
    return value;
};

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

function Home() {
    const navigate = useNavigate();
    const authUser = useAuthUser();
    const [fadeOut, setFadeOut] = useState(false);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false);
    const [paginaAtual, setPaginaAtual] = useState(0);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");

    useEffect(() => {
        const skipModal = localStorage.getItem("skipInfoModal");
        const isLoggedIn = localStorage.getItem("isLoggedIn");
        if (!isLoggedIn && !skipModal) setMostrarModal(true);
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setUsersLoading(true);
                const data = await UsersAPI.listUsers();
                if (!mounted) return;
                setUsers(Array.isArray(data) ? data : []);
                setUsersError("");
            } catch (error) {
                if (!mounted) return;
                setUsersError(error.message || "Não foi possível carregar os utilizadores");
            } finally {
                if (mounted) setUsersLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const currentUserId =
        authUser?.id ||
        (typeof window !== "undefined" ? window.localStorage.getItem("userId") : null);

    const handleViewProfile = (userId) => {
        if (!userId) return;
        setFadeOut(true);
        setTimeout(() => navigate(`/info/${userId}`), 300);
    };

    const filteredUsers = users.filter((user) => Number(user.id) !== Number(currentUserId));
    const filteredByTipo = filteredUsers.filter((user) => {
        if (filtroTipo === "banda") return String(user.tipo || "").toLowerCase() === "banda";
        if (filtroTipo === "solo") return String(user.tipo || "").toLowerCase() !== "banda";
        return true;
    });

    const handleProfileClick = () => {
        setFadeOut(true);
        setTimeout(() => navigate("/info"), 300);
    };

    const paginas = [
        {
            titulo: "Bem-vindo ao SoundCircle!",
            texto:
                "Liga-te a outros músicos, descobre novos estilos e colabora em projetos criativos. O SoundCircle é o teu espaço para expandir a tua rede musical e encontrar oportunidades únicas.",
            imagem: "/banner.png",
        },
        {
            titulo: "Explora Prefis de Músicos e de BAndas",
            texto:
                "Na página inicial, encontras músicos recomendados com base no teu perfil. Clica em 'Ver Perfil' para conhecer mais sobre o artista, o instrumento que toca e o seu estilo musical. Podes tambêm conhecer projetos de bandas!",
            imagem: "/teste1.png",
        },
        {
            titulo: "Perfil e Características",
            texto:
                "Cada músico tem um espaço personalizado com a sua história, talentos e características únicas. Essas tags ajudam-te a encontrar pessoas com quem tenhas mais afinidade musical.",
            imagem: "/teste2.png",
        },
        {
            titulo: "Mensagens e Colaboração 💬",
            texto:
                "Usa o chat integrado para conversar, planear ensaios ou partilhar ideias criativas. Podes trocar mensagens diretamente com outros artistas ou bandas e fortalecer a tua rede de contactos.",
            imagem: "/teste3.png",
        },
        {
            titulo: "Circle AI",
            texto:
                "O SoundCircle inclui uma assistente virtual inteligente que sugere musicos com base nas características que procures. Experimenta e descobre novas conexões musicais!",
            imagem: "/teste4.png",
        },
    ];

    const proximaPagina = () => {
        if (paginaAtual < paginas.length - 1) setPaginaAtual(paginaAtual + 1);
        else fecharModal();
    };

    const anteriorPagina = () => {
        if (paginaAtual > 0) setPaginaAtual(paginaAtual - 1);
    };

    const saltarTutorial = () => {
        setMostrarModal(false);
        if (naoMostrarNovamente) {
            localStorage.setItem("skipInfoModal", "true");
        }
    };

    const fecharModal = () => {
        if (naoMostrarNovamente) {
            localStorage.setItem("skipInfoModal", "true");
        }
        setMostrarModal(false);
    };

    const renderPlaceholderCards = (count = 6) =>
        Array.from({ length: count }).map((_, index) => (
            <div className={styles.card} key={`placeholder-${index}`}>
                <div className={styles.cardBorderTop}></div>
                <div className={styles.person}>
                    <img src={PLACEHOLDER} alt="Foto de Perfil" />
                </div>
                <div className={styles.cardInfo}>
                    <span className={styles.name}>Miguel Dias</span>
                    <div className={styles.infoDetails}>
                        <span className={styles.job}>Guitarrista, 21 anos</span>
                    </div>
                </div>
                <button onClick={handleProfileClick}>Ver Perfil</button>
            </div>
        ));

    const renderUserCards = () => {
        if (usersLoading) {
            return renderPlaceholderCards();
        }
        if (usersError) {
            return renderPlaceholderCards();
        }
        if (!filteredByTipo.length) {
            return <p className={styles.statusMessage}>Sem perfis para este filtro</p>;
        }
        return filteredByTipo.map((user) => {
            const isBanda = String(user.tipo || "").toLowerCase() === "banda";
            const idade = calcularIdade(user.data_nascimento);
            const instrumentoLabel = user.instrumento_nome || user.instrumento || "";
            const localizacao = user.localizacao || "";

            return (
                <div className={styles.card} key={user.id}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src={resolvePhotoUrl(user.foto_url)} alt={`Foto de ${user.nome}`} />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>{user.nome}</span>
                        <div className={styles.infoDetails}>
                            {isBanda ? (
                                <>
                                    <span className={styles.job}>
                                        {["Banda", idade ? `${idade} anos` : null, localizacao].filter(Boolean).join(" · ")}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className={styles.job}>
                                        {[instrumentoLabel || "Instrumento não definido", idade ? `${idade} anos` : null, localizacao]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <button onClick={() => handleViewProfile(user.id)}>Ver Perfil</button>
                </div>
            );
        });
    };

    return (
        <>
            <section className={styles.filterBar}>
                <div>
                    <p className={styles.filterEyebrow}>Explorar perfis</p>
                    <h2 className={styles.filterTitle}>O que queres ver?</h2>
                </div>
                <div className={styles.filterButtons}>
                    <button
                        type="button"
                        className={`${styles.filterButton} ${filtroTipo === "todos" ? styles.filterButtonActive : ""}`}
                        onClick={() => setFiltroTipo("todos")}
                    >
                        Todos
                    </button>
                    <button
                        type="button"
                        className={`${styles.filterButton} ${filtroTipo === "solo" ? styles.filterButtonActive : ""}`}
                        onClick={() => setFiltroTipo("solo")}
                    >
                        Músicos
                    </button>
                    <button
                        type="button"
                        className={`${styles.filterButton} ${filtroTipo === "banda" ? styles.filterButtonActive : ""}`}
                        onClick={() => setFiltroTipo("banda")}
                    >
                        Bandas
                    </button>
                </div>
            </section>

            <section className={`${styles.cardSection} ${fadeOut ? styles.fadeOut : ""}`}>
                {renderUserCards()}
            </section>

            {mostrarModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.tutorialModal}>
                        <div className={styles.modalLeft}>
                            {paginaAtual === 0 ? (
                                <div className={styles.welcomeVisual}>
                                    <div className={styles.welcomeTextBlock}>
                                        <span className={styles.welcomeTitle}>BEM-VINDO</span>
                                        <span className={styles.welcomeSubtitle}>AO SOUND</span>
                                        <span className={styles.welcomeSubtitle}>CIRCLE</span>
                                    </div>
                                    <div className={styles.welcomeMark} aria-hidden="true" />
                                </div>
                            ) : (
                                <img src={paginas[paginaAtual].imagem} alt={paginas[paginaAtual].titulo} />
                            )}
                        </div>
                        <div className={styles.modalRight}>
                            <h2>{paginas[paginaAtual].titulo}</h2>
                            <p>{paginas[paginaAtual].texto}</p>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={naoMostrarNovamente}
                                    onChange={() => setNaoMostrarNovamente(!naoMostrarNovamente)}
                                />
                                Não mostrar novamente
                            </label>
                            <div className={styles.modalButtons}>
                                <button
                                    className={styles.secondaryButton}
                                    onClick={anteriorPagina}
                                    disabled={paginaAtual === 0}>
                                    Anterior
                                </button>
                                <button className={styles.primaryButton} onClick={proximaPagina}>
                                    {paginaAtual === paginas.length - 1 ? "Concluir" : "Seguinte"}
                                </button>
                            </div>
                            <button className={styles.skipButton} onClick={saltarTutorial}>
                                Saltar tutorial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Home;
