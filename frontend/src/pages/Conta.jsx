import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./conta.module.css";
import useSignIn from "react-auth-kit/hooks/useSignIn";
import useSignOut from "react-auth-kit/hooks/useSignOut";
import useIsAuthenticated from "react-auth-kit/hooks/useIsAuthenticated";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";

const PLACEHOLDER_PHOTO =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const DEFAULT_TRAITS = ["Extrovertido", "Criativo", "Dedicado"];

const INITIAL_PERFIL_STATE = {
    nome: "",
    email: "",
    idade: "",
    dataNascimento: "",
    tipo: "solo",
    instrumento: "",
    anosExperiencia: "",
    descricao: "",
    foto: PLACEHOLDER_PHOTO,
};

const INITIAL_REGISTER_STATE = {
    nome: "",
    email: "",
    dataNascimento: "",
    sexo: "Masculino",
    instrumento: "",
    anosExperiencia: "",
    descricao: "",
    foto: "",
    password: "",
    confirmPassword: "",
};

const INITIAL_LOGIN_STATE = {
    email: "",
    password: "",
};

const toDateInputValue = (value) => {
    if (!value) return "";
    return value.split("T")[0];
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const [year, month, day] = toDateInputValue(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month, day));
};

const calcularIdade = (dataNascimento) => {
    const nascimento = parseDateOnly(dataNascimento);
    if (!nascimento) return "";
    const diferenca = Date.now() - nascimento.getTime();
    const idadeData = new Date(diferenca);
    return Math.abs(idadeData.getUTCFullYear() - 1970);
};

const experienciaParaNivel = (anos) => {
    const valor = Number(anos);
    if (Number.isNaN(valor)) return "intermedio";
    if (valor < 2) return "iniciante";
    if (valor < 5) return "intermedio";
    if (valor < 10) return "avancado";
    return "profissional";
};

const resolvePhotoUrl = (value) => {
    if (!value) return PLACEHOLDER_PHOTO;
    if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://"))
        return value;
    if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
    return value;
};

const mapPerfilFromResponse = (payload) => {
    if (!payload) return { ...INITIAL_PERFIL_STATE };
    const user = payload.user || payload;
    const instrumento = payload.instrumentos?.[0];
    const anosExperienciaValue =
        instrumento?.anos_experiencia ?? instrumento?.anosExperiencia ?? null;

    return {
        nome: user?.nome ?? "",
        email: user?.email ?? "",
        idade: user?.data_nascimento ? calcularIdade(user.data_nascimento) : "",
        dataNascimento: toDateInputValue(user?.data_nascimento),
        tipo: user?.tipo || "solo",
        instrumento: instrumento?.instrumento_nome || "",
        anosExperiencia:
            anosExperienciaValue === null || anosExperienciaValue === undefined
                ? ""
                : String(anosExperienciaValue),
        descricao: user?.descricao || "",
        foto: resolvePhotoUrl(user?.foto_url),
    };
};

const base64UrlEncode = (obj) =>
    window
        .btoa(JSON.stringify(obj))
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

const gerarSessaoToken = (user, expiresInSeconds = 60 * 60) => {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        sub: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };
    return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.signature`;
};

function Conta() {
    const navigate = useNavigate();
    const signIn = useSignIn();
    const signOut = useSignOut();
    const isAuthenticated = useIsAuthenticated();
    const authUser = useAuthUser();
    const [modoEdicao, setModoEdicao] = useState(false);
    const [modoRegisto, setModoRegisto] = useState(false);
    const [mostrarPass, setMostrarPass] = useState(false);

    const [perfil, setPerfil] = useState({ ...INITIAL_PERFIL_STATE });

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [perfilOriginal, setPerfilOriginal] = useState({ ...INITIAL_PERFIL_STATE });
    const [caracteristicas, setCaracteristicas] = useState([...DEFAULT_TRAITS]);
    const [caracteristicasOriginais, setCaracteristicasOriginais] = useState([...DEFAULT_TRAITS]);
    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
    const [authError, setAuthError] = useState("");
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [perfilCarregado, setPerfilCarregado] = useState(false);
    const [perfilErro, setPerfilErro] = useState("");
    const [perfilMensagem, setPerfilMensagem] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const currentUserId = authUser?.id || (typeof window !== "undefined" ? window.localStorage.getItem("userId") : null);
    const [novoPerfilCaracteristicas, setNovoPerfilCaracteristicas] = useState([]);
    const [perfilFotoFile, setPerfilFotoFile] = useState(null);
    const [novoPerfilFotoFile, setNovoPerfilFotoFile] = useState(null);

    const [novoPerfil, setNovoPerfil] = useState({ ...INITIAL_REGISTER_STATE });
    const [loginData, setLoginData] = useState({ ...INITIAL_LOGIN_STATE });

    const fetchPerfil = useCallback(async (userId) => {
        const response = await UsersAPI.getProfile(userId);
        const perfilMapeado = mapPerfilFromResponse(response);
        setPerfil(perfilMapeado);
        setPerfilOriginal(perfilMapeado);
        setPerfilCarregado(true);
        return perfilMapeado;
    }, []);

    const uploadPhoto = useCallback(async (userId, file) => {
        if (!file) return null;
        const response = await UsersAPI.uploadPhoto(userId, file);
        return response?.url;
    }, []);

    const authenticateUser = useCallback(
        async (email, passwordValue) => {
            const user = await UsersAPI.login({ email, password: passwordValue });
            try {
                await fetchPerfil(user.id);
            } catch (error) {
                const fallbackPerfil = mapPerfilFromResponse({ user });
                setPerfil(fallbackPerfil);
                setPerfilOriginal(fallbackPerfil);
                setPerfilCarregado(true);
            }

            const signedIn = signIn({
                auth: {
                    token: gerarSessaoToken(user),
                    type: "Bearer",
                },
                userState: { email: user.email, id: user.id, nome: user.nome },
            });
            if (!signedIn) {
                throw new Error("Não foi possível iniciar sessão");
            }
            if (typeof window !== "undefined") {
                window.localStorage.setItem("userId", user.id);
            }
            setModoEdicao(false);
            setPassword("");
            setConfirmPassword("");
            setAuthError("");
            return user;
        },
        [fetchPerfil, signIn]
    );

    useEffect(() => {
        if (!isAuthenticated) {
            setModoRegisto(false);
            setPerfil({ ...INITIAL_PERFIL_STATE });
            setPerfilOriginal({ ...INITIAL_PERFIL_STATE });
            setPerfilCarregado(false);
            return;
        }

        if (typeof window === "undefined") return;
        const storedUserId = window.localStorage.getItem("userId");
        if (storedUserId && !perfilCarregado) {
            fetchPerfil(storedUserId).catch(() => {
                setPerfilCarregado(true);
            });
        }
    }, [fetchPerfil, isAuthenticated, perfilCarregado]);

    useEffect(() => {
        setAuthError("");
    }, [modoRegisto]);

    const opcoesPredefinidas = [
        "Criativo", "Disciplinado", "Comunicativo", "Empático",
        "Perfeccionista", "Colaborativo", "Inovador", "Pontual",
        "Motivado", "Resiliente", "Amigável", "Líder nato",
    ];

    const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

    const handleAddTrait = (trait) => {
        if (!caracteristicas.includes(trait)) setCaracteristicas([...caracteristicas, trait]);
        setMostrarOpcoes(false);
    };

    const handleRemoveTrait = (trait) => setCaracteristicas(caracteristicas.filter((t) => t !== trait));

    const handleEditChange = (campo, valor) => setPerfil({ ...perfil, [campo]: valor });

    const handleDataNascimentoChange = (valor) => {
        setPerfil({
            ...perfil,
            dataNascimento: valor,
            idade: valor ? calcularIdade(valor) : "",
        });
    };

    const toggleNovoPerfilTrait = (trait) => {
        setNovoPerfilCaracteristicas((prev) =>
            prev.includes(trait) ? prev.filter((item) => item !== trait) : [...prev, trait]
        );
    };

    const resetRegisterForm = () => {
        setNovoPerfil({ ...INITIAL_REGISTER_STATE });
        setNovoPerfilCaracteristicas([]);
        setNovoPerfilFotoFile(null);
        setAuthError("");
    };

    const persistProfileChanges = async () => {
        if (!currentUserId) {
            throw new Error("Sessão inválida. Inicia novamente.");
        }
        let fotoUrlPayload =
            perfil.foto && perfil.foto.startsWith("http") ? perfil.foto : PLACEHOLDER_PHOTO;

        if (perfilFotoFile && currentUserId) {
            const uploadedUrl = await uploadPhoto(currentUserId, perfilFotoFile);
            if (uploadedUrl) {
                fotoUrlPayload = uploadedUrl;
                setPerfil((prev) => ({ ...prev, foto: resolvePhotoUrl(uploadedUrl) }));
            }
            setPerfilFotoFile(null);
        }

        const anosExperienciaValue =
            perfil.anosExperiencia === "" ? null : Number(perfil.anosExperiencia);
        const safeAnosExperiencia =
            Number.isFinite(anosExperienciaValue) && anosExperienciaValue >= 0
                ? anosExperienciaValue
                : null;

        const payload = {
            nome: perfil.nome.trim(),
            email: perfil.email.trim(),
            tipo: perfil.tipo || "solo",
            descricao: perfil.descricao,
            foto_url: fotoUrlPayload,
            data_nascimento: perfil.dataNascimento || null,
            instrumento: perfil.instrumento,
            instrumentoNivel:
                safeAnosExperiencia !== null ? experienciaParaNivel(safeAnosExperiencia) : null,
            anosExperiencia: safeAnosExperiencia,
        };

        await UsersAPI.updateProfile(currentUserId, payload);

        if (password) {
            await UsersAPI.updatePassword(currentUserId, password);
            setPassword("");
            setConfirmPassword("");
        }

        setPerfilOriginal({ ...perfil });
        setCaracteristicasOriginais([...caracteristicas]);
    };

    const handleToggleEdicao = async () => {
        if (modoEdicao) {
            if (!validarEmail(perfil.email)) {
                setPerfilErro("Email inválido");
                return;
            }
            if (password && password !== confirmPassword) {
                setPerfilErro("As passwords não coincidem!");
                return;
            }
            try {
                setIsSavingProfile(true);
                await persistProfileChanges();
                setPerfilErro("");
                setPerfilMensagem("Perfil atualizado com sucesso!");
                setModoEdicao(false);
                setMostrarOpcoes(false);
            } catch (error) {
                setPerfilErro(error.message || "Não foi possível atualizar o perfil");
            } finally {
                setIsSavingProfile(false);
            }
            return;
        }
        setPerfilErro("");
        setPerfilMensagem("");
        setModoEdicao(true);
        setMostrarOpcoes(false);
    };

    const handleCancelar = () => {
        setPerfil({ ...perfilOriginal });
        setCaracteristicas([...caracteristicasOriginais]);
        setModoEdicao(false);
        setPassword("");
        setConfirmPassword("");
        setPerfilErro("");
        setPerfilMensagem("");
        setPerfilFotoFile(null);
    };

    const handleSignOut = () => {
        signOut();
        if (typeof window !== "undefined") {
            window.localStorage.removeItem("userId");
        }
        setPerfil({ ...INITIAL_PERFIL_STATE });
        setPerfilOriginal({ ...INITIAL_PERFIL_STATE });
        setCaracteristicas([...DEFAULT_TRAITS]);
        setCaracteristicasOriginais([...DEFAULT_TRAITS]);
        setPerfilCarregado(false);
        setModoEdicao(false);
        setPassword("");
        setConfirmPassword("");
        setPerfilErro("");
        setPerfilMensagem("");
        setPerfilFotoFile(null);
        setNovoPerfilFotoFile(null);
    };
    
    const handleLogin = async () => {
        const email = loginData.email.trim();
        const passwordValue = loginData.password.trim();

        if (!validarEmail(email)) {
            setAuthError("Email inválido");
            return;
        }
        if (!passwordValue) {
            setAuthError("Introduz a tua palavra-passe");
            return;
        }

        setIsAuthLoading(true);
        try {
            await authenticateUser(email, passwordValue);
            setLoginData({ ...INITIAL_LOGIN_STATE });
        } catch (err) {
            setAuthError(err.message || "Credenciais inválidas");
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleRegisto = async () => {
        if (!novoPerfil.nome.trim()) {
            setAuthError("O nome é obrigatório");
            return;
        }
        if (!validarEmail(novoPerfil.email)) {
            setAuthError("Email inválido");
            return;
        }
        if (!novoPerfil.dataNascimento) {
            setAuthError("Data de nascimento é obrigatória");
            return;
        }
        if (!novoPerfil.password || !novoPerfil.confirmPassword) {
            setAuthError("Introduz e confirma a palavra-passe");
            return;
        }
        if (novoPerfil.password !== novoPerfil.confirmPassword) {
            setAuthError("As passwords não coincidem");
            return;
        }

        setIsRegistering(true);
        try {
            const fotoUrlPayload =
                novoPerfil.foto && novoPerfil.foto.startsWith("http")
                    ? novoPerfil.foto
                    : PLACEHOLDER_PHOTO;

            const anosExperienciaValue =
                novoPerfil.anosExperiencia === "" ? null : Number(novoPerfil.anosExperiencia);
            const safeAnosExperiencia =
                Number.isFinite(anosExperienciaValue) && anosExperienciaValue >= 0
                    ? anosExperienciaValue
                    : null;

            await UsersAPI.register({
                nome: novoPerfil.nome,
                email: novoPerfil.email,
                password: novoPerfil.password,
                tipo: "solo",
                descricao: novoPerfil.descricao,
                foto_url: fotoUrlPayload,
                data_nascimento: novoPerfil.dataNascimento || null,
                instrumento: novoPerfil.instrumento,
                instrumentoNivel:
                    safeAnosExperiencia !== null ? experienciaParaNivel(safeAnosExperiencia) : null,
                anosExperiencia: safeAnosExperiencia,
            });
            const loggedUser = await authenticateUser(novoPerfil.email, novoPerfil.password);
            if (novoPerfilFotoFile && loggedUser?.id) {
                await uploadPhoto(loggedUser.id, novoPerfilFotoFile);
                setNovoPerfilFotoFile(null);
                await fetchPerfil(loggedUser.id);
            }
            if (novoPerfilCaracteristicas.length) {
                setCaracteristicas([...novoPerfilCaracteristicas]);
                setCaracteristicasOriginais([...novoPerfilCaracteristicas]);
            }
            setNovoPerfilCaracteristicas([]);
            setNovoPerfilFotoFile(null);
            setNovoPerfil({ ...INITIAL_REGISTER_STATE });
        } catch (err) {
            setAuthError(err.message || "Não foi possível criar a conta");
        } finally {
            setIsRegistering(false);
        }
    };

    const renderAuthModal = () => (
        <div className={styles.loginModalOverlay}>
            <div className={styles.loginModal}>
                {!modoRegisto ? (
                    <>
                        <h2>Iniciar Sessão</h2>
                        {authError && <p className={styles.authError}>{authError}</p>}
                        <input
                            className={styles.loginInput}
                            placeholder="Email"
                            value={loginData.email}
                            onChange={(e) => {
                                setLoginData({ ...loginData, email: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Password"
                            type="password"
                            value={loginData.password}
                            onChange={(e) => {
                                setLoginData({ ...loginData, password: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <div className={styles.loginButtons}>
                            <button
                                type="button"
                                className={styles.loginConfirm}
                                onClick={handleLogin}
                                disabled={isAuthLoading}
                            >
                                {isAuthLoading ? "A entrar..." : "Entrar"}
                            </button>
                            <button
                                type="button"
                                className={styles.loginCancel}
                                onClick={() => navigate("/")}
                            >
                                Cancelar
                            </button>
                        </div>

                        <p
                            className={styles.registarLink}
                            onClick={() => {
                                setModoRegisto(true);
                                resetRegisterForm();
                            }}>
                            Criar nova conta
                        </p>
                    </>
                ) : (
                    <>
                        <h2>Criar Conta</h2>
                        {authError && <p className={styles.authError}>{authError}</p>}

                        <div className={styles.registoFotoWrapper}>
                            <img
                                className={styles.registoFotoPreview}
                                src={novoPerfil.foto || PLACEHOLDER_PHOTO}
                                alt="preview"
                            />

                            <label htmlFor="registoFotoInput" className={styles.registoFotoButton}>
                                <span className="material-symbols-outlined">photo_camera</span>
                                Alterar Foto
                            </label>
                            <input
                                id="registoFotoInput"
                                type="file"
                                accept="image/*"
                                className={styles.registoFotoInput}
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setNovoPerfilFotoFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => setNovoPerfil({ ...novoPerfil, foto: reader.result });
                                        reader.readAsDataURL(file);
                                    }
                                    setAuthError("");
                                }}
                            />
                        </div>

                        <input
                            className={styles.loginInput}
                            placeholder="Nome"
                            value={novoPerfil.nome}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, nome: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Email"
                            value={novoPerfil.email}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, email: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Data de nascimento"
                            type="date"
                            value={novoPerfil.dataNascimento}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, dataNascimento: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <select
                            className={styles.loginInput}
                            value={novoPerfil.sexo}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, sexo: e.target.value });
                                setAuthError("");
                            }}
                        >
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                        </select>

                        <input
                            className={styles.loginInput}
                            placeholder="Instrumento"
                            value={novoPerfil.instrumento}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, instrumento: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Anos de Experiência"
                            type="number"
                            value={novoPerfil.anosExperiencia}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, anosExperiencia: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <textarea
                            className={styles.loginInput}
                            placeholder="Descrição"
                            value={novoPerfil.descricao}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, descricao: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <div className={styles.registerTraits}>
                            <p>Características (opcional)</p>
                            <div className={styles.registerTraitsOptions}>
                                {opcoesPredefinidas.map((trait) => (
                                    <button
                                        type="button"
                                        key={trait}
                                        className={`${styles.traitChip} ${
                                            novoPerfilCaracteristicas.includes(trait)
                                                ? styles.traitChipActive
                                                : ""
                                        }`}
                                        onClick={() => {
                                            toggleNovoPerfilTrait(trait);
                                            setAuthError("");
                                        }}
                                    >
                                        {trait}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <input
                            className={styles.loginInput}
                            type="password"
                            placeholder="Password"
                            value={novoPerfil.password}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, password: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            type="password"
                            placeholder="Confirmar Password"
                            value={novoPerfil.confirmPassword}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, confirmPassword: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <div className={styles.loginButtons}>
                            <button
                                type="button"
                                className={styles.loginConfirm}
                                onClick={handleRegisto}
                                disabled={isRegistering}
                            >
                                {isRegistering ? "A criar..." : "Criar Conta"}
                            </button>
                            <button
                                type="button"
                                className={styles.loginCancel}
                                onClick={() => {
                                    setModoRegisto(false);
                                    resetRegisterForm();
                                }}
                            >
                                Cancelar
                            </button>
                        </div>

                        <p
                            className={styles.registarLink}
                            onClick={() => {
                                setModoRegisto(false);
                                resetRegisterForm();
                            }}>
                            Já tenho conta
                        </p>
                    </>
                )}
            </div>
        </div>
    );

    if (!isAuthenticated) {
        return (
            <>
                <Header />
                {renderAuthModal()}
            </>
        );
    }

    if (!perfilCarregado) {
        return (
            <>
                <Header />
                <main className={styles.infoPage}>
                    <p>A carregar o teu perfil...</p>
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className={styles.infoPage}>
                <button className={styles.backButton} onClick={() => navigate("/")}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className={styles.profileContainer}>
                    <div className={styles.leftSection}>
                        <div className={styles.photoWrapper}>
                            <img className={styles.photo} src={perfil.foto} alt="Foto de perfil" />

                            {modoEdicao && (
                                <div className={styles.photoButtons}>
                                    <button
                                        className={styles.removePhotoButton}
                                        onClick={() => {
                                            setPerfil({ ...perfil, foto: PLACEHOLDER_PHOTO });
                                            setPerfilFotoFile(null);
                                        }}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>

                                    <label htmlFor="fotoInput" className={styles.editPhotoLabel}>
                                        <span className="material-symbols-outlined">photo_camera</span>
                                        <input
                                            id="fotoInput"
                                            type="file"
                                            accept="image/*"
                                            className={styles.fileInput}
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setPerfilFotoFile(file);
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setPerfil({ ...perfil, foto: reader.result });
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        {modoEdicao ? (
                            <>
                                <input className={styles.inputText} value={perfil.nome} onChange={(e) => handleEditChange("nome", e.target.value)} />
                                <input className={styles.inputText} value={perfil.email} type="email" onChange={(e) => handleEditChange("email", e.target.value)} placeholder="Email" />
                                <input
                                    className={styles.inputText}
                                    value={perfil.dataNascimento || ""}
                                    type="date"
                                    onChange={(e) => handleDataNascimentoChange(e.target.value)}
                                />
                                <input className={styles.inputText} value={perfil.instrumento} onChange={(e) => handleEditChange("instrumento", e.target.value)} />
                                <input className={styles.inputText} value={perfil.anosExperiencia} type="number" onChange={(e) => handleEditChange("anosExperiencia", e.target.value)} />

                                <div className={styles.passwordGroup}>
                                    <input
                                        className={styles.inputText}
                                        type={mostrarPass ? "text" : "password"}
                                        value={password}
                                        placeholder="Nova palavra-passe"
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button type="button" className={styles.showPass} onClick={() => setMostrarPass(!mostrarPass)}>
                                        <span className="material-symbols-outlined">{mostrarPass ? "visibility_off" : "visibility"}</span>
                                    </button>
                                </div>

                                <input
                                    className={styles.inputText}
                                    type="password"
                                    placeholder="Confirmar palavra-passe"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </>
                        ) : (
                            <>
                                <h1 className={styles.name}>{perfil.nome}</h1>
                                <p className={styles.basicInfo}>{perfil.idade} anos · {perfil.instrumento}</p>
                                {perfil.anosExperiencia !== "" && perfil.anosExperiencia !== null && (
                                    <p className={styles.experience}>
                                        A tocar há {perfil.anosExperiencia} ano(s)
                                    </p>
                                )}
                                <p className={styles.basicInfo}>{perfil.email}</p>
                            </>
                        )}
                    </div>

                    <div className={styles.description}>
                        <h2>Sobre</h2>
                        {modoEdicao ? (
                            <textarea className={styles.inputArea} value={perfil.descricao} onChange={(e) => handleEditChange("descricao", e.target.value)} />
                        ) : (
                            <p>{perfil.descricao}</p>
                        )}

                        <div className={styles.editButtonArea}>
                            {modoEdicao ? (
                                <>
                                    <button
                                        className={`${styles.editButton} ${styles.active}`}
                                        onClick={handleToggleEdicao}
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? "A guardar..." : "Guardar"}
                                    </button>
                                    <button className={styles.cancelButton} onClick={handleCancelar}>Cancelar</button>
                                </>
                            ) : (
                                <button className={styles.editButton} onClick={handleToggleEdicao}>Editar Perfil</button>
                            )}
                        </div>
                        {(perfilErro || perfilMensagem) && (
                            <p className={perfilErro ? styles.profileError : styles.profileSuccess}>
                                {perfilErro || perfilMensagem}
                            </p>
                        )}
                    </div>
                </div>

                <section className={styles.traitsSection}>
                    <div className={styles.traitsGrid}>
                        {caracteristicas.map((t, i) => (
                            <div key={i} className={styles.traitCard}>
                                <span>{t}</span>
                                {modoEdicao && <button className={styles.removeButton} onClick={() => handleRemoveTrait(t)}>✕</button>}
                            </div>
                        ))}

                        {modoEdicao && (
                            <button className={`${styles.addButton} ${mostrarOpcoes && styles.addButtonActive}`} onClick={() => setMostrarOpcoes(!mostrarOpcoes)}>
                                <span className="material-symbols-outlined">{mostrarOpcoes ? "close" : "add"}</span>
                            </button>
                        )}
                    </div>

                    {mostrarOpcoes && (
                        <div className={styles.traitOptions}>
                            {opcoesPredefinidas.map((o, i) => (
                                <button key={i} className={styles.optionButton} onClick={() => handleAddTrait(o)}>{o}</button>
                            ))}
                        </div>
                    )}
                </section>

                <div className={styles.signOutArea}>
                    <button className={styles.signOutButton} onClick={handleSignOut}>
                        <span className="material-symbols-outlined">logout</span>Sair da Conta
                    </button>
                </div>
            </main>

            <Menu />
        </>
    );
}

export default Conta;
