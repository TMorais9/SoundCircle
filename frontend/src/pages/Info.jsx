import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./info.module.css";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";

const PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const OVERLAY =
    "linear-gradient(rgba(255, 255, 255, 0.307), rgba(255, 255, 255, 0.658))";

const INSTRUMENT_BACKGROUNDS = {
    guitar: { image: "/guitar.png", size: "100%", position: "center" },
    drums: { image: "/drums.png", size: "100%", position: "center" },
    bass: { image: "/bass.png", size: "100%", position: "center" },
    piano: { image: "/piano.png", size: "100%", position: "bottom" },
    voice: { image: "/micro.png", size: "100%", position: "top" },
};

const normalizeInstrumentName = (value) =>
    (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

const resolveInstrumentKey = (instrumentName) => {
    const normalized = normalizeInstrumentName(instrumentName);
    if (normalized.includes("guit")) return "guitar";
    if (normalized.includes("drum") || normalized.includes("bater")) return "drums";
    if (
        normalized.includes("bass") ||
        normalized.includes("baix") ||
        normalized.includes("contrabaixo")
    )
        return "bass";
    if (normalized.includes("pian") || normalized.includes("tecl")) return "piano";
    if (
        normalized.includes("voz") ||
        normalized.includes("vocal") ||
        normalized.includes("cantar") ||
        normalized.includes("micro")
    )
        return "voice";
    return "default";
};

const buildBackgroundStyle = (instrumentName) => {
    const key = resolveInstrumentKey(instrumentName);
    const config = INSTRUMENT_BACKGROUNDS[key] || INSTRUMENT_BACKGROUNDS.default;
    if (!config) {
        return { backgroundImage: OVERLAY };
    }
    return {
        backgroundImage: `${OVERLAY}, url('${config.image}')`,
        backgroundSize: `cover, ${config.size}`,
        backgroundPosition: `center, ${config.position}`,
        backgroundRepeat: "no-repeat, no-repeat",
    };
};

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

const inferYearsFromNivel = (nivel) => {
    const normalized = (nivel || "").toLowerCase();
    switch (normalized) {
        case "iniciante":
            return 1;
        case "intermedio":
            return 3;
        case "avancado":
            return 7;
        case "profissional":
            return 12;
        default:
            return null;
    }
};

const resolveInstrumentExperience = (instrumento) => {
    if (!instrumento) return null;
    const value =
        instrumento.anos_experiencia ?? instrumento.anosExperiencia ?? instrumento.anosExperienciaEst ?? null;
    if (value !== null && value !== undefined) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return inferYearsFromNivel(instrumento.nivel);
};

const formatNivelLabel = (nivel) => {
    if (!nivel) return "";
    return nivel.charAt(0).toUpperCase() + nivel.slice(1);
};

const mapProfile = (payload) => {
    if (!payload) return null;
    const user = payload.user || payload;
    const instrumentos = payload.instrumentos || [];
    const instrumentosDetalhes = instrumentos.map((inst) => {
        const anos = resolveInstrumentExperience(inst);
        return {
            id: inst.instrumento_id,
            nome: inst.instrumento_nome,
            nivel: inst.nivel,
            anosExperiencia: anos,
            rotulo:
                anos !== null
                    ? `${inst.instrumento_nome} · ${anos} ${anos === 1 ? "ano" : "anos"}`
                    : inst.nivel
                        ? `${inst.instrumento_nome} · ${formatNivelLabel(inst.nivel)}`
                        : inst.instrumento_nome,
        };
    });

    const carNames = (payload.caracteristicas || []).map((c) => c.nome);

    return {
        id: user.id,
        nome: user.nome,
        idade: calcularIdade(user.data_nascimento),
        localizacao: user.localizacao || "",
        instrumento:
            instrumentosDetalhes[0]?.nome ||
            user.instrumento ||
            (user.tipo === "banda" ? "Banda" : "Artista Solo"),
        anosExperiencia: instrumentosDetalhes[0]?.anosExperiencia ?? null,
        descricao: user.descricao,
        foto: resolvePhotoUrl(user.foto_url),
        caracteristicas: carNames.length
            ? carNames
            : instrumentosDetalhes.length
                ? instrumentosDetalhes.map((i) => i.rotulo)
                : [],
        tipo: user.tipo,
        instrumentosDetalhes,
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
        : [];

    const backgroundStyle = useMemo(() => {
        const firstInstrument =
            profile?.instrumentosDetalhes?.find((inst) => inst?.nome)?.nome ||
            profile?.instrumentosDetalhes?.[0]?.rotulo ||
            null;
        const instrumentName =
            firstInstrument ||
            profile?.instrumento ||
            profile?.nome; // última hipótese para bandas/artistas sem instrumento definido
        return buildBackgroundStyle(instrumentName);
    }, [profile?.instrumento, profile?.instrumentosDetalhes, profile?.nome]);

    return (
        <>
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
                        <div className={styles.profileContainer} style={backgroundStyle}>
                            <div className={styles.leftSection}>
                                <img
                                    className={styles.photo}
                                    src={profile?.foto || PLACEHOLDER}
                                    alt={`Foto de ${profile?.nome || "Músico"}`}
                                    onClick={() => setIsModalOpen(true)}
                                />
                                <h1 className={styles.name}>{profile?.nome}</h1>
                                <p className={styles.basicInfo}>
                                    {profile?.instrumento}
                                </p>
                                <p className={styles.basicInfo}>
                                    {profile?.idade ? `${profile.idade} anos` : "Idade não definida"}
                                    {profile?.sexo ? ` · ${profile.sexo}` : ""}
                                    {profile?.localizacao ? ` · ${profile.localizacao}` : ""}
                                </p>
                                {profile?.anosExperiencia !== null &&
                                    profile?.anosExperiencia !== undefined &&
                                    profile?.anosExperiencia !== "" && (
                                        <p className={styles.experience}>
                                            A tocar há {profile.anosExperiencia} ano(s)
                                        </p>
                                    )}
                            </div>
                            <div className={styles.rightSection}>
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
                        </div>

                        <section className={styles.traitsSection}>
                            <div className={styles.traitsGrid}>
                                {traits.length === 0 && (
                                    <p className={styles.basicInfo} style={{ textAlign: "center", width: "100%" }}>
                                        Ainda não tens características atribuídas
                                    </p>
                                )}
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
