import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Info.module.css";
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

const mapProfile = (payload) => {
    if (!payload) return null;
    const user = payload.user || payload;
    const instrumentos = payload.instrumentos || [];
    return {
        id: user.id,
        nome: user.nome,
        idade: calcularIdade(user.data_nascimento),
        instrumento:
            instrumentos[0]?.instrumento_nome ||
            user.instrumento ||
            (user.tipo === "banda" ? "Banda" : "Artista Solo"),
        anosExperiencia: instrumentos[0]?.nivel || null,
        descricao: user.descricao,
        foto: resolvePhotoUrl(user.foto_url),
        caracteristicas: instrumentos.map((i) => i.instrumento_nome),
        tipo: user.tipo,
    };
};

function Info() {
    const navigate = useNavigate();
    const { id } = useParams();
    const authUser = useAuthUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const currentUserId = useMemo(() => {
        const localId = typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
        return authUser?.id || localId;
    }, [authUser]);

    const targetUserId = useMemo(() => {
        return id || currentUserId;
    }, [id, currentUserId]);

    useEffect(() => {
        let mounted = true;
        if (!targetUserId) {
            setError("Nenhum utilizador selecionado");
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setLoading(true);
                const data = await UsersAPI.getProfile(targetUserId);
                if (!mounted) return;
                setProfile(mapProfile(data));
                setError("");
            } catch (err) {
                if (!mounted) return;
                setError(err.message || "Não foi possível carregar o perfil");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [targetUserId]);

    const handleBack = () => {
        setFadeOut(true);
        setTimeout(() => {
            navigate("/");
        }, 500);
    };

    const traits = profile?.caracteristicas?.length
        ? profile.caracteristicas
        : ["Colaborativo", "Criativo", "Apaixonado"];

    return (
        <>
            <Header />
            <main className={`${styles.infoPage} ${fadeOut ? styles.fadeOut : ""}`}>
                <button
                    className={styles.backButton}
                    onClick={handleBack}
                    aria-label="Voltar à Home">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                {loading ? (
                    <p className={styles.statusMessage}>A carregar perfil...</p>
                ) : error ? (
                    <p className={styles.errorMessage}>{error}</p>
                ) : (
                    <>
                        <div className={styles.profileContainer}>
                            <div className={styles.leftSection}>
                                <img
                                    className={styles.photo}
                                    src={profile?.foto || PLACEHOLDER}
                                    alt={`Foto de ${profile?.nome || "Músico"}`}
                                    onClick={() => setIsModalOpen(true)}
                                />
                                <h1 className={styles.name}>{profile?.nome}</h1>
                                <p className={styles.basicInfo}>
                                    {profile?.idade ? `${profile.idade} anos` : "Idade não definida"} ·{" "}
                                    {profile?.instrumento}
                                </p>
                                {profile?.anosExperiencia && (
                                    <p className={styles.experience}>
                                        A tocar há {profile.anosExperiencia} anos
                                    </p>
                                )}
                            </div>
                            <div className={styles.description}>
                                <h2>Sobre</h2>
                                <p>{profile?.descricao || "Este músico ainda não adicionou uma descrição."}</p>
                                <div className={styles.buttonArea}>
                                    {profile?.id && Number(profile.id) !== Number(currentUserId) && (
                                        <button
                                            className={styles.messageButton}
                                            onClick={() => {
                                                setFadeOut(true);
                                                setTimeout(
                                                    () =>
                                                        navigate(`/messages?user=${profile.id}`, {
                                                            state: {
                                                                targetUser: {
                                                                    id: profile.id,
                                                                    nome: profile.nome,
                                                                    foto: profile.foto,
                                                                },
                                                            },
                                                        }),
                                                    250
                                                );
                                            }}>
                                            <span className="material-symbols-outlined">message</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <section className={styles.traitsSection}>
                            <div className={styles.traitsGrid}>
                                {traits.map((trait, index) => (
                                    <div key={index} className={styles.traitCard}>
                                        <span>{trait}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>
            <Menu />

            {isModalOpen && profile && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button
                            className={styles.closeButton}
                            onClick={() => setIsModalOpen(false)}
                            aria-label="Fechar imagem">
                            ✕
                        </button>
                        <img
                            src={profile.foto || PLACEHOLDER}
                            alt={`Foto de ${profile.nome}`}
                            className={styles.modalImage}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

export default Info;
